// file: src/lib/utils.ts
// Utility functions for class name merging and conditional styling
import { clsx, type ClassValue } from 'clsx'; // clsx, ClassValue
import { twMerge } from 'tailwind-merge'; // twMerge

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
