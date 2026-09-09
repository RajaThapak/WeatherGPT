"use client";

import { ForecastRow } from "./ForecastRow";
import { AirQualityRow } from "./AirQualityRow";
import { useView } from "@/lib/view-context";

export function ForecastSection() {
  const { activeSegment } = useView();
  return activeSegment === "Air quality" ? <AirQualityRow /> : <ForecastRow />;
}
