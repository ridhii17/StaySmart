console.log("listingData:", listingData);

if (
  !listingData ||
  !listingData.coordinates ||
  listingData.coordinates.length !== 2
) {
  console.log("Coordinates missing, map not loaded.");
} else {
  const [lon, lat] = listingData.coordinates;

  const map = L.map("map").setView([lat, lon], 12);

  L.tileLayer(
    `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${geoapifyKey}`,
    {
      maxZoom: 20,
      attribution: "© OpenStreetMap contributors, © Geoapify",
    }
  ).addTo(map);

  L.marker([lat, lon])
    .addTo(map)
    .bindPopup(`<b>${listingData.title}</b>`)
    .openPopup();
}
