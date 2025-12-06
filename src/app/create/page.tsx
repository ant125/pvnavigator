"use client";

import { useState } from "react";
import DraggableMap from "../components/DraggableMapComponent";

export default function CreatePage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className="p-4 space-y-4">
      <DraggableMap
  initialCenter={{ lat: 48.13743, lng: 11.57549 }} // например, центр Мюнхена
  onLocationSelect={(lat, lng) => setCoords({ lat, lng })}
/>

      {coords && (
        <div className="p-3 bg-gray-100 rounded">
          <p><strong>Latitude:</strong> {coords.lat}</p>
          <p><strong>Longitude:</strong> {coords.lng}</p>
        </div>
      )}
    </div>
  );
}