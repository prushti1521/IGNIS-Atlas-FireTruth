export interface California2020ReferenceArtifact {
  artifact_id: string;
  reference: {
    publisher: string;
    dataset: string;
    service_url: string;
    retrieval_sha256: string;
    feature_count_total: number;
    feature_count_california: number;
    coverage_semantics: string;
    limitations: string[];
  };
  method: {
    grid: string;
    projection: string;
    intersection_rule: string;
    period: string;
    temporal_evaluation: string;
    harmonized_spatial_prediction: string;
  };
  reference_area_km2_projected: number;
  reference_cells: string[];
  metrics: Record<string, {
    predicted_cells: number;
    reference_cells: number;
    intersection_cells: number;
    precision: number | null;
    recall: number | null;
    iou: number | null;
  }>;
  monthly_activity_2020: Array<{
    month: number;
    modis_active_cell_days: number;
    viirs_active_cell_days: number;
  }>;
  display_perimeters: {
    type: 'FeatureCollection';
    simplification_tolerance_degrees: number;
    geometry_semantics: string;
    features: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[];
  };
}

let referencePromise: Promise<California2020ReferenceArtifact> | null = null;
let cachedReference: California2020ReferenceArtifact | null = null;

export function loadCalifornia2020Reference(): Promise<California2020ReferenceArtifact> {
  if (cachedReference) return Promise.resolve(cachedReference);
  if (!referencePromise) {
    referencePromise = fetch('/data/california2020Reference.json', {
      headers: { Accept: 'application/json' }
    })
      .then(response => {
        if (!response.ok) throw new Error(`California reference request failed (${response.status}).`);
        return response.json() as Promise<California2020ReferenceArtifact>;
      })
      .then(artifact => {
        if (!artifact.reference || !artifact.metrics || !artifact.display_perimeters) {
          throw new Error('California reference artifact failed schema validation.');
        }
        cachedReference = artifact;
        return artifact;
      })
      .catch(error => {
        referencePromise = null;
        throw error;
      });
  }
  return referencePromise;
}
