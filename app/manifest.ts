import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinWise",
    short_name: "FinWise",
    description: "Private statement upload and AI-assisted transaction categorization for personal finance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFBFF",
    theme_color: "#633EF2",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
