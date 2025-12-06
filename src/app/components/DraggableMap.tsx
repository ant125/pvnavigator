"use client";

import { useEffect, useRef } from "react";

interface DraggableMapProps {
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function DraggableMap({ onLocationSelect }: DraggableMapProps) {
  // 🇷🇺 Ссылка на контейнер карты
  // 🇬🇧 Ref to the map container
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // 🇷🇺 Создаем карту Google
    // 🇬🇧 Create Google Map
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 55.7558, lng: 37.6173 }, // Moscow
      zoom: 12,
    });

    // 🇷🇺 Создаем перетаскиваемый маркер
    // 🇬🇧 Create draggable marker
    const marker = new google.maps.Marker({
      position: map.getCenter(),
      map,
      draggable: true,
    });

    // 🇷🇺 При окончании перетаскивания маркера — отправляем координаты
    // 🇬🇧 When marker dragging ends — send coordinates to parent
    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos && onLocationSelect) {
        onLocationSelect(pos.lat(), pos.lng());
      }
    });
  }, [onLocationSelect]);

  // 🇷🇺 Контейнер карты
  // 🇬🇧 Map container
  return <div ref={mapRef} className="w-full h-[400px]" />;
}