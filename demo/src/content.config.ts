import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { galleryLoader } from "@altner/astro-justified-gallery-layout/loader";

const cameraSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  lens: z.string().optional(),
  focalLength: z.number().optional(),
  fNumber: z.number().optional(),
  exposureTime: z.number().optional(),
  iso: z.number().optional(),
});

const gpsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const iptcSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  keywordsHierarchy: z.array(z.array(z.string())).optional(),
});

const photoMetaSchema = z.object({
  camera: cameraSchema.optional(),
  dateTaken: z.coerce.date().optional(),
  gps: gpsSchema.optional(),
  iptc: iptcSchema.optional(),
});

const photos = defineCollection({
  loader: galleryLoader({
    base: "./src/assets/photos",
    exif: true,
    preview: true,
  }),
  schema: ({ image }) =>
    z.object({
      src: image(),
      alt: z.string().optional(),
      meta: photoMetaSchema.optional(),
      preview: z.string().optional(),
    }),
});

export const collections = { photos };
