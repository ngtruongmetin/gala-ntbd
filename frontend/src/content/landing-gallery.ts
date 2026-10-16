export interface LandingGalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

// Add official event photos here. The gallery stays hidden while this list is empty.
export const landingGallery: LandingGalleryImage[] = [];
