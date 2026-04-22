export type UnitPackKey = "standard_1000" | "lead_500";
export type UnitPackClass = "standard" | "lead";

export type UnitPackDefinition = {
  key: UnitPackKey;
  label: string;
  description: string;
  unitClass: UnitPackClass;
  unitsStandard: number;
  unitsLead: number;
  amountCents: number;
  stripePriceEnvVar?: string;
};

const UNIT_PACKS: Record<UnitPackKey, UnitPackDefinition> = {
  standard_1000: {
    key: "standard_1000",
    label: "Standard Pack (1,000 units)",
    description: "Adds 1,000 standard units for the current billing cycle.",
    unitClass: "standard",
    unitsStandard: 1000,
    unitsLead: 0,
    amountCents: 1500,
    stripePriceEnvVar: "STRIPE_PRICE_PACK_STANDARD_1000",
  },
  lead_500: {
    key: "lead_500",
    label: "Lead Pack (500 units)",
    description: "Adds 500 lead units for the current billing cycle.",
    unitClass: "lead",
    unitsStandard: 0,
    unitsLead: 500,
    amountCents: 2500,
    stripePriceEnvVar: "STRIPE_PRICE_PACK_LEAD_500",
  },
};

export function isUnitPackKey(value: unknown): value is UnitPackKey {
  return value === "standard_1000" || value === "lead_500";
}

export function getUnitPack(key: UnitPackKey): UnitPackDefinition {
  return UNIT_PACKS[key];
}

export function getUnitPackCatalog() {
  return (Object.values(UNIT_PACKS) as UnitPackDefinition[]).map((pack) => ({
    ...pack,
    configuredPriceId:
      pack.stripePriceEnvVar && process.env[pack.stripePriceEnvVar]
        ? process.env[pack.stripePriceEnvVar] ?? null
        : null,
  }));
}
