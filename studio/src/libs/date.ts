import { Timestamp } from "./firebase";

export const toTimestame = (d: string) => {
  return Timestamp.fromDate(new Date(d));
};
