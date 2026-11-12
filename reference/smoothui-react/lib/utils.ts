import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  try {
    return twMerge(clsx(inputs));
  } catch {
    return inputs
      .flat()
      .filter(Boolean)
      .map((x) =>
        typeof x === "object" && x !== null
          ? Object.keys(x)
              .filter((k) => (x as Record<string, boolean>)[k])
              .join(" ")
          : String(x)
      )
      .join(" ");
  }
}

