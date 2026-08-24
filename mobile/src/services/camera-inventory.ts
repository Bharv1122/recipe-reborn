export type CapturePurpose = 'label' | 'pantry' | 'fridge';

export interface PendingFoodPhoto {
  uri: string;
  purpose: CapturePurpose;
  capturedAt: string;
}

/** Photos stay on-device in this foundation build. Production upload must use
 * a bearer-protected endpoint and return draft items for required review before save. */
export function makePendingFoodPhoto(uri: string, purpose: CapturePurpose): PendingFoodPhoto {
  return { uri, purpose, capturedAt: new Date().toISOString() };
}
