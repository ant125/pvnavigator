"use client";

import { useEffect, useRef } from "react";

interface DraggableMapProps {
  initialCenter: { lat: number; lng: number };
  addressString?: string;
  onLocationSelect?: (lat: number, lng: number) => void;
  /** 
   * If true, the map will not update marker position when initialCenter changes.
   * Use this after the user has manually adjusted the marker.
   * @default false
   */
  lockMarkerPosition?: boolean;
  /**
   * Map type to display.
   * - "hybrid": Satellite imagery with labels (default, good for finding houses)
   * - "roadmap": Standard road map (good for precise positioning)
   * - "satellite": Pure satellite imagery
   * - "terrain": Terrain map
   * @default "hybrid"
   */
  mapTypeId?: google.maps.MapTypeId | "hybrid" | "roadmap" | "satellite" | "terrain";
  /**
   * If true, the marker cannot be dragged.
   * Use this after final coordinate confirmation.
   * @default false
   */
  disableDragging?: boolean;
}

export default function DraggableMap({
  initialCenter,
  addressString,
  onLocationSelect,
  lockMarkerPosition = false,
  mapTypeId = "hybrid",
  disableDragging = false,
}: DraggableMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  
  // Track if marker was dragged locally (additional safety measure)
  const markerWasDraggedLocally = useRef<boolean>(false);

  // -----------------------------
  // 0. Reset local drag state when parent signals new address
  // When lockMarkerPosition becomes false, it means user entered a new address
  // and we should allow geocoding to reposition the marker
  // -----------------------------
  useEffect(() => {
    if (!lockMarkerPosition) {
      // Parent signals that marker position should be unlocked (new address entered)
      // Reset local drag tracking to allow marker repositioning
      markerWasDraggedLocally.current = false;
    }
  }, [lockMarkerPosition]);

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
        mapTypeId: mapTypeId,
      });
    }

    if (!geocoder.current) {
      geocoder.current = new google.maps.Geocoder();
    }

    if (!markerInstance.current) {
      markerInstance.current = new google.maps.Marker({
        position: initialCenter,
        map: mapInstance.current!,
        draggable: !disableDragging,
      });
    }
  }, []);

  // -----------------------------
  // 1b. Update map type when mapTypeId prop changes
  // -----------------------------
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.setMapTypeId(mapTypeId);
    }
  }, [mapTypeId]);

  // -----------------------------
  // 1c. Update marker draggability when disableDragging prop changes
  // -----------------------------
  useEffect(() => {
    if (markerInstance.current) {
      markerInstance.current.setDraggable(!disableDragging);
    }
  }, [disableDragging]);

  // -----------------------------
  // 2. Обновляем центр карты, если изменился initialCenter
  // 2. Update map center when initialCenter changes
  // CRITICAL: Do NOT update if marker was dragged (user position is source of truth)
  // -----------------------------
  useEffect(() => {
    if (!mapInstance.current || !markerInstance.current) return;
    
    // CRITICAL RULE: If marker was dragged or lockMarkerPosition is true,
    // do NOT override the marker position - user's adjustment is the source of truth
    if (lockMarkerPosition || markerWasDraggedLocally.current) {
      // Only pan the map view, but keep marker at user's position
      return;
    }

    mapInstance.current.setCenter(initialCenter);
    markerInstance.current.setPosition(initialCenter);
  }, [initialCenter, lockMarkerPosition]);

  // -----------------------------
  // 3. Перетаскивание маркера
  // 3. Marker dragging handler
  // CRITICAL: After drag, marker position becomes the source of truth
  // -----------------------------
  useEffect(() => {
    if (!markerInstance.current) return;

    const marker = markerInstance.current;

    const listener = marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        // CRITICAL: Mark that marker was dragged - position is now source of truth
        // This prevents any subsequent geocoding or center updates from overriding
        markerWasDraggedLocally.current = true;
        
        if (onLocationSelect) {
          onLocationSelect(pos.lat(), pos.lng());
        }
      }
    });

    return () => listener.remove();
  }, [onLocationSelect]);

  // -----------------------------
  // 4. Геокодинг: центрируем карту по адресу
  // 4. Geocoding: center map by address
  // NOTE: This is a fallback for when parent doesn't do geocoding.
  // When using the component in analyse flow, geocoding is handled by the parent.
  // CRITICAL: Never override marker position if it was dragged
  // -----------------------------
  useEffect(() => {
    if (!addressString || !geocoder.current || !mapInstance.current || !markerInstance.current)
      return;
    
    // CRITICAL: Do NOT geocode if marker was dragged - user position is source of truth
    if (lockMarkerPosition || markerWasDraggedLocally.current) {
      return;
    }

    geocoder.current.geocode({ address: addressString }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location;

        // Double-check: still don't override if marker was dragged during geocoding
        if (markerWasDraggedLocally.current) {
          return;
        }

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
  }, [addressString, lockMarkerPosition]);

  return <div ref={mapRef} className="w-full h-full" />;
}