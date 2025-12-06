"use client";

import { useEffect, useRef } from "react";

interface DraggableMapProps {
  initialCenter: { lat: number; lng: number };
  
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function DraggableMap({
  initialCenter,
  addressString,
  onLocationSelect,
}: DraggableMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  // -----------------------------
  // 1. Инициализация карты (один раз)
  // 1. Initialize map (run only once)
  // -----------------------------
  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 19,
        mapTypeId: "hybrid",
      });
    }

    if (!geocoder.current) {
      geocoder.current = new google.maps.Geocoder();
    }

    if (!markerInstance.current) {
      markerInstance.current = new google.maps.Marker({
        position: initialCenter,
        map: mapInstance.current!,
        draggable: true,
      });
    }
  }, []);

  // -----------------------------
  // 2. Обновляем центр карты, если изменился initialCenter
  // 2. Update map center when initialCenter changes
  // -----------------------------
  useEffect(() => {
    if (!mapInstance.current || !markerInstance.current) return;

    mapInstance.current.setCenter(initialCenter);
    markerInstance.current.setPosition(initialCenter);
  }, [initialCenter]);

  // -----------------------------
  // 3. Перетаскивание маркера
  // 3. Marker dragging handler
  // -----------------------------
  useEffect(() => {
    if (!markerInstance.current) return;

    const marker = markerInstance.current;

    const listener = marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos && onLocationSelect) {
        onLocationSelect(pos.lat(), pos.lng());
      }
    });

    return () => listener.remove();
  }, [onLocationSelect]);

  // -----------------------------
  // 4. Геокодинг: центрируем карту по адресу
  // 4. Geocoding: center map by address
  // -----------------------------
  useEffect(() => {
    if (!addressString || !geocoder.current || !mapInstance.current || !markerInstance.current)
      return;

    geocoder.current.geocode({ address: addressString }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location;

        // Центрируем карту и перемещаем маркер
        // Center map + move marker
        mapInstance.current!.setCenter(location);
        markerInstance.current!.setPosition(location);

        // Передаем координаты наверх
        // Pass coordinates to parent component
        if (onLocationSelect) {
          onLocationSelect(location.lat(), location.lng());
        }
      } else {
        console.warn("Geocoding failed:", status);
      }
    });
  }, [addressString]);

  return <div ref={mapRef} className="w-full h-full" />;
}