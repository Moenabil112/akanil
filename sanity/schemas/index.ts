import { objectTypes } from "./objects";
import { windowTypes } from "./windows";
import { insight } from "./insight";

// Full schema registry: shared objects + 8 window documents + Insights.
export const schemaTypes = [...objectTypes, ...windowTypes, insight];
