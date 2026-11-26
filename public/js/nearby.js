(async function loadNearbyPlaces() {
  const container = document.getElementById("nearbyPlaces");
  if (!container) return;
  const listingId = container.dataset.listingId;
  try {
    const response = await fetch(`/api/nearby/${encodeURIComponent(listingId)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nearby places could not be loaded.");
    if (!result.places?.length) {
      container.textContent = result.message || "No nearby places were found in the search area.";
      return;
    }
    const list = document.createElement("ul");
    list.className = "nearby-list";
    result.places.forEach((place) => {
      const item = document.createElement("li");
      const details = document.createElement("span");
      const title = document.createElement("strong");
      const category = document.createElement("small");
      title.textContent = place.name;
      category.textContent = place.category;
      details.append(title, category);
      item.append(details);
      if (Number.isFinite(Number(place.distance))) {
        const distance = document.createElement("b");
        const km = Number(place.distance) / 1000;
        distance.textContent = km < 1 ? `${Math.round(Number(place.distance))} m` : `${km.toFixed(1)} km`;
        item.append(distance);
      }
      list.append(item);
      if (window.stayMap && place.coordinates?.length === 2) {
        const marker = L.circleMarker([place.coordinates[1], place.coordinates[0]], { radius: 6, color: "#087f78", fillColor: "#ffffff", fillOpacity: 1, weight: 2 }).addTo(window.stayMap);
        const popup = document.createElement("span");
        popup.textContent = `${place.name} · ${place.category}`;
        marker.bindPopup(popup);
      }
    });
    container.replaceChildren(list);
  } catch (error) {
    container.textContent = error.message || "Nearby places are temporarily unavailable.";
  }
})();
