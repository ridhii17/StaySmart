const styles = [
  "Remote-work ready",
  "Family friendly",
  "Couples retreat",
  "Long-stay friendly",
  "Outdoor escape",
];

const accessibilityFeatures = [
  "Step-free entrance",
  "Elevator access",
  "Wide doorways",
  "Accessible bathroom",
  "Ground-floor bedroom",
];

const ecoPractices = [
  "Solar power",
  "Refillable toiletries",
  "Filtered drinking water",
  "Waste sorting",
  "Locally sourced essentials",
];

function selectedValues(value, allowed) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.filter((item) => typeof item === "string" && allowed.includes(item)))];
}

module.exports = { styles, accessibilityFeatures, ecoPractices, selectedValues };
