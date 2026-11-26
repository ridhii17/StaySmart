const HostVerification = require("../models/host-verification");
const User = require("../models/user");
const mongoose = require("mongoose");

module.exports.renderForm = async (req, res) => {
  const verification = await HostVerification.findOne({ user: req.user._id });
  res.render("features/host-verification", {
    verification,
    canReviewVerifications: Boolean(process.env.VERIFICATION_ADMIN_EMAIL)
      && String(req.user.email || "").toLowerCase() === String(process.env.VERIFICATION_ADMIN_EMAIL).trim().toLowerCase(),
  });
};

module.exports.submitRequest = async (req, res) => {
  const businessName = String(req.body.businessName || "").trim().slice(0, 120);
  const verificationDetails = String(req.body.verificationDetails || "").trim().slice(0, 1200);
  const evidenceUrl = String(req.body.evidenceUrl || "").trim().slice(0, 500);
  let normalizedUrl = "";
  if (evidenceUrl) {
    try {
      const parsed = new URL(evidenceUrl);
      if (parsed.protocol !== "https:") throw new Error("https required");
      normalizedUrl = parsed.toString();
    } catch {
      req.flash("error", "Use a valid HTTPS link for your public business or professional profile.");
      return res.redirect("/host/verification");
    }
  }
  if (businessName.length < 2 || verificationDetails.length < 30) {
    req.flash("error", "Add a host or business name and at least 30 characters describing how travelers can verify your hosting activity.");
    return res.redirect("/host/verification");
  }

  const current = await HostVerification.findOne({ user: req.user._id });
  if (current?.status === "verified") {
    req.flash("success", "Your host profile is already verified.");
    return res.redirect("/profile");
  }
  if (current?.status === "pending") {
    req.flash("error", "Your verification request is already waiting for review.");
    return res.redirect("/host/verification");
  }

  await HostVerification.findOneAndUpdate(
    { user: req.user._id },
    {
      $set: {
        businessName,
        evidenceUrl: normalizedUrl,
        verificationDetails,
        status: "pending",
        reviewerNote: "",
      },
      $unset: { reviewer: 1, reviewedAt: 1 },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await User.updateOne({ _id: req.user._id }, { $set: { role: "host", hostVerificationStatus: "pending" } });
  req.flash("success", "Your host verification request was submitted for manual review.");
  res.redirect("/profile");
};

module.exports.adminQueue = async (req, res) => {
  const adminEmail = String(process.env.VERIFICATION_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) return res.status(503).render("listings/error", { statusCode: 503, message: "Host verification review is not configured." });
  if (!req.user || String(req.user.email || "").toLowerCase() !== adminEmail) {
    return res.status(403).render("listings/error", { statusCode: 403, message: "You are not allowed to review host verification requests." });
  }
  const requests = await HostVerification.find({ status: "pending" })
    .populate("user", "username email fName lName image")
    .sort({ createdAt: 1 });
  res.render("features/host-verification-admin", { requests });
};

module.exports.decideRequest = async (req, res) => {
  const adminEmail = String(process.env.VERIFICATION_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) return res.status(503).render("listings/error", { statusCode: 503, message: "Host verification review is not configured." });
  if (!req.user || String(req.user.email || "").toLowerCase() !== adminEmail) {
    return res.status(403).render("listings/error", { statusCode: 403, message: "You are not allowed to review host verification requests." });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).render("listings/error", { statusCode: 404, message: "Verification request not found." });

  const status = req.body.decision === "approve" ? "verified" : req.body.decision === "reject" ? "rejected" : "";
  if (!status) return res.status(400).render("listings/error", { statusCode: 400, message: "Choose approve or reject." });
  const verification = await HostVerification.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    { $set: { status, reviewer: req.user._id, reviewerNote: String(req.body.reviewerNote || "").trim().slice(0, 500), reviewedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!verification) {
    req.flash("error", "That request was already reviewed or could not be found.");
    return res.redirect("/admin/host-verifications");
  }
  await User.updateOne({ _id: verification.user }, { $set: { hostVerificationStatus: status } });
  req.flash("success", status === "verified" ? "Host profile verified." : "Host verification request declined.");
  res.redirect("/admin/host-verifications");
};
