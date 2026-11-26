const mapElement = document.getElementById("map");

if (mapElement && window.L && Array.isArray(listingData?.coordinates) && listingData.coordinates.length === 2) {
  const [longitude, latitude] = listingData.coordinates;
  window.stayMap = L.map(mapElement).setView([latitude, longitude], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(window.stayMap);

  const title = document.createElement("span");
  title.textContent = listingData.title || "Stay location";
  L.marker([latitude, longitude]).addTo(window.stayMap).bindPopup(title).openPopup();
  window.stayCoordinates = [longitude, latitude];
} else if (mapElement) {
  mapElement.innerHTML = '<p class="map-unavailable">Map coordinates are not available for this place yet.</p>';
}
