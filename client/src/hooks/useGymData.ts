/**
 * useGymData — Hook pobierający dane gym z Supabase z fallbackiem na dane lokalne
 * =================================================================================
 * Jeśli Supabase nie odpowiada (brak kluczy, timeout, błąd) — używa danych z gymMap.ts.
 * Subskrybuje zmiany w tabelach sectors, boulders, wall_segments.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, WALLER_GYM_ID } from "../lib/supabase";
import { sectors as localSectors, wallSegments as localSegments, boulderPins as localBoulders } from "../data/gymMap";
import type { BoulderPin, HoldColorKey, Point, Sector, SectorHighlight, SectorPolygon, WallSegment } from "../types";

interface GymDataState {
  sectors: Sector[];
  boulders: BoulderPin[];
  wallSegments: WallSegment[];
  isLoading: boolean;
  error: string | null;
  isLocalFallback: boolean;
}

function mapSectorRow(row: any): Sector {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    shortName: row.short_name,
    
    cameraOffset: row.camera_offset,
    zoomScale: row.zoom_scale ?? 1,
    
    polygons: (row.polygons as SectorPolygon[]) || [],

    label: (row.label as Point) || { x: 0, y: 0 },
    fill: row.fill || "#ffffff",
    settingDate: row.setting_date || "",
    removalDate: row.removal_date || "",
    author: row.author || "",
    description: row.description || "",
    highlight: row.highlight as SectorHighlight | null,
  };
}

function mapSegmentRow(row: any): WallSegment {
  return {
    id: row.id,
    sectorId: row.sector_id,
    name: row.name || "",
    start: (row.start_point as Point) || { x: 0, y: 0 },
    end: (row.end_point as Point) || { x: 0, y: 0 },
    angleLabel: row.angle_label || "",
  };
}

function mapBoulderRow(row: any): BoulderPin {console.log("Boulder DB:", row.position);
  return {
    id: row.id,
    name: row.name || "",
    sectorId: row.sector_id,
    segmentId: row.segment_id || "",
    position: (row.position as Point) || { x: 0, y: 0 },
    grade: row.grade,
    holdColor: (row.hold_color || "blue") as HoldColorKey,
    author: row.author || "",
  };
}

export function useGymData(gymId: string = WALLER_GYM_ID): GymDataState & {
  refetch: () => Promise<void>;
} {
  const [state, setState] = useState<GymDataState>({
    sectors: localSectors,
    boulders: localBoulders,
    wallSegments: localSegments,
    isLoading: true,
    error: null,
    isLocalFallback: true,
  });

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Jeśli Supabase nie jest skonfigurowany — użyj danych lokalnych
    if (!isSupabaseConfigured || !supabase) {
      setState({
        sectors: localSectors,
        wallSegments: localSegments,
        boulders: localBoulders,
        isLoading: false,
        error: null,
        isLocalFallback: true,
      });
      return;
    }

    try {
      const [sectorsRes, segmentsRes, bouldersRes] = await Promise.all([
        supabase
          .from("sectors")
          .select("*")
          .eq("gym_id", gymId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("wall_segments")
          .select("*")
          .eq("gym_id", gymId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("boulders")
          .select("*")
          .eq("gym_id", gymId)
          .eq("is_active", true),
      ]);

      if (sectorsRes.error) throw sectorsRes.error;
      if (segmentsRes.error) throw segmentsRes.error;
      if (bouldersRes.error) throw bouldersRes.error;

      // Jeśli baza jest pusta — użyj danych lokalnych
      const dbSectors = (sectorsRes.data || []).map(mapSectorRow);
      
      console.log(dbSectors[0]);
      console.log("DB polygons", dbSectors[0]?.polygons);
      
      const dbSegments = (segmentsRes.data || []).map(mapSegmentRow);
      

      const dbBoulders = (bouldersRes.data || []).map(mapBoulderRow);
      console.log("DB boulders:", dbBoulders [0]);


      if (dbSectors.length === 0) {
        setState({
          sectors: localSectors,
          wallSegments: localSegments,
          boulders: localBoulders,
          isLoading: false,
          error: null,
          isLocalFallback: true,
        });
        return;
      }

      setState({
        sectors: dbSectors,
        wallSegments: dbSegments,
        boulders: dbBoulders,
        isLoading: false,
        error: null,
        isLocalFallback: false,
      });
    } catch (err: any) {
      // Na błąd — fallback na dane lokalne
      console.warn("[useGymData] Supabase error, using local fallback:", err.message);
      setState({
        sectors: localSectors,
        wallSegments: localSegments,
        boulders: localBoulders,
        isLoading: false,
        error: null,
        isLocalFallback: true,
      });
    }
  }, [gymId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time subskrypcja (tylko jeśli Supabase jest skonfigurowany)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`gym-${gymId}-realtime`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sectors", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boulders", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wall_segments", filter: `gym_id=eq.${gymId}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [gymId, fetchAll]);

  return { ...state, refetch: fetchAll };
}
