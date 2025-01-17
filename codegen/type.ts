import type { TypeSchema } from "./schema.ts";

interface ScalarType {
  name: string;
  typeGuard(variable: string): string;
  encoder(variable: string): string;
  dataCheck(variable: string): string;
  decoder(variable: string): string;
}

const scalarTypes: Record<string, ScalarType> = {
  "http://www.w3.org/2001/XMLSchema#boolean": {
    name: "boolean",
    typeGuard(v) {
      return `typeof ${v} === "boolean"`;
    },
    encoder(v) {
      return `{ "@value": ${v} }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@value" in ${v}
        && typeof ${v}["@value"] === "boolean"`;
    },
    decoder(v) {
      return `${v}["@value"]`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#integer": {
    name: "number",
    typeGuard(v) {
      return `typeof ${v} === "number" && Number.isInteger(${v})`;
    },
    encoder(v) {
      return `{
        "@type": "http://www.w3.org/2001/XMLSchema#integer",
        "@value": ${v},
      }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@type" in ${v}
        && ${v}["@type"] === "http://www.w3.org/2001/XMLSchema#integer"
        && "@value" in ${v} && typeof ${v}["@value"] === "number"`;
    },
    decoder(v) {
      return `${v}["@value"] as number`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#nonNegativeInteger": {
    name: "number",
    typeGuard(v) {
      return `typeof ${v} === "number" && Number.isInteger(${v}) && ${v} >= 0`;
    },
    encoder(v) {
      return `{
        "@type": "http://www.w3.org/2001/XMLSchema#nonNegativeInteger",
        "@value": ${v},
      }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@type" in ${v}
        && ${v}["@type"] === "http://www.w3.org/2001/XMLSchema#nonNegativeInteger"
        && "@value" in ${v} && typeof ${v}["@value"] === "number"`;
    },
    decoder(v) {
      return `${v}["@value"]`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#float": {
    name: "number",
    typeGuard(v) {
      return `typeof ${v} === "number" && !Number.isNaN(${v})`;
    },
    encoder(v) {
      return `{
        "@type": "http://www.w3.org/2001/XMLSchema#float",
        "@value": ${v},
      }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@type" in ${v}
        && ${v}["@type"] === "http://www.w3.org/2001/XMLSchema#float"
        && "@value" in ${v} && typeof ${v}["@value"] === "number"`;
    },
    decoder(v) {
      return `${v}["@value"]`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#string": {
    name: "string",
    typeGuard(v) {
      return `typeof ${v} === "string"`;
    },
    encoder(v) {
      return `{ "@value": ${v} }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@value" in ${v}
        && typeof ${v}["@value"] === "string" && !("@language" in ${v})`;
    },
    decoder(v) {
      return `${v}["@value"]`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#anyURI": {
    name: "URL",
    typeGuard(v) {
      return `${v} instanceof URL`;
    },
    encoder(v) {
      return `{ "@id": ${v}.href }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@id" in ${v}
        && typeof ${v}["@id"] === "string"`;
    },
    decoder(v) {
      return `new URL(${v}["@id"])`;
    },
  },
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString": {
    name: "LanguageString",
    typeGuard(v) {
      return `${v} instanceof LanguageString`;
    },
    encoder(v) {
      return `{
        "@value": ${v}.toString(),
        "@language": ${v}.language.compact(),
      }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@language" in ${v} && "@value" in ${v}
        && typeof ${v}["@language"] === "string"
        && typeof ${v}["@value"] === "string"`;
    },
    decoder(v) {
      return `new LanguageString(${v}["@value"], ${v}["@language"])`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#dateTime": {
    name: "Temporal.Instant",
    typeGuard(v) {
      return `${v} instanceof Temporal.Instant`;
    },
    encoder(v) {
      return `{
        "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
        "@value": ${v}.toString(),
      }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@type" in ${v}
        && "@value" in ${v} && typeof ${v}["@value"] === "string"
        && ${v}["@type"] === "http://www.w3.org/2001/XMLSchema#dateTime"`;
    },
    decoder(v) {
      return `Temporal.Instant.from(${v}["@value"])`;
    },
  },
  "http://www.w3.org/2001/XMLSchema#duration": {
    name: "Temporal.Duration",
    typeGuard(v) {
      return `${v} instanceof Temporal.Duration`;
    },
    encoder(v) {
      return `{
        "@type": "http://www.w3.org/2001/XMLSchema#duration",
        "@value": ${v}.toString(),
      }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@type" in ${v}
        && "@value" in ${v} && typeof ${v}["@value"] === "string"
        && ${v}["@type"] === "http://www.w3.org/2001/XMLSchema#duration"`;
    },
    decoder(v) {
      return `Temporal.Duration.from(${v}["@value"])`;
    },
  },
  "fedify:langTag": {
    name: "LanguageTag",
    typeGuard(v) {
      return `${v} instanceof LanguageTag`;
    },
    encoder(v) {
      return `{ "@value": ${v}.compact() }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@value" in ${v}
        && typeof ${v}["@value"] === "string" && !("@language" in ${v})`;
    },
    decoder(v) {
      return `parseLanguageTag(${v}["@value"])`;
    },
  },
  "fedify:publicKey": {
    name: "CryptoKey",
    typeGuard(v) {
      return `${v} instanceof CryptoKey`;
    },
    encoder(v) {
      return `{ "@value": await exportSpki(${v}) }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@value" in ${v}
        && typeof ${v}["@value"] === "string"`;
    },
    decoder(v) {
      return `await importSpki(${v}["@value"])`;
    },
  },
  "fedify:units": {
    name: '"cm" | "feet" | "inches" | "km" | "m" | "miles"',
    typeGuard(v) {
      return `${v} == "cm" || ${v} == "feet" || ${v} == "inches" ` +
        `|| ${v} == "km" || ${v} == "m" || ${v} == "miles"`;
    },
    encoder(v) {
      return `{ "@value": ${v} }`;
    },
    dataCheck(v) {
      return `typeof ${v} === "object" && "@value" in ${v}
      && (${v}["@value"] == "cm" || ${v}["@value"] == "feet" ` +
        `|| ${v}["@value"] == "inches" || ${v}["@value"] == "km" ` +
        `|| ${v}["@value"] == "m" || ${v}["@value"] == "miles")`;
    },
    decoder(v) {
      return `${v}["@value"]`;
    },
  },
};

export function getTypeName(
  typeUri: string,
  types: Record<string, TypeSchema>,
): string {
  if (typeUri in types) return types[typeUri].name;
  if (typeUri in scalarTypes) return scalarTypes[typeUri].name;
  throw new Error(`Unknown type: ${typeUri}`);
}

export function getTypeNames(
  typeUris: string[],
  types: Record<string, TypeSchema>,
  parentheses = false,
): string {
  if (typeUris.length < 1) return "never";
  else if (typeUris.length === 1) return getTypeName(typeUris[0], types);
  let typeNames = typeUris.map((typeUri) => getTypeName(typeUri, types));
  typeNames = typeNames.filter((t, i) => typeNames.indexOf(t) === i);
  const t = typeNames.join(" | ");
  return parentheses && typeNames.length > 1 ? `(${t})` : t;
}

export function isScalarType(
  typeUri: string,
  types: Record<string, TypeSchema>,
): boolean {
  if (typeUri in scalarTypes) return true;
  else if (typeUri in types) return !types[typeUri].entity;
  throw new Error(`Unknown type: ${typeUri}`);
}

export function areAllScalarTypes(
  typeUris: string[],
  types: Record<string, TypeSchema>,
): boolean {
  return typeUris.every((typeUri) => isScalarType(typeUri, types));
}

export function getSubtypes(
  typeUri: string,
  types: Record<string, TypeSchema>,
  excludeSelf = false,
): string[] {
  const subtypes: string[] = excludeSelf ? [] : [typeUri];
  for (const uri in types) {
    const type = types[uri];
    if (type.extends === typeUri) subtypes.push(...getSubtypes(uri, types));
  }
  return subtypes.filter((t, i) => subtypes.indexOf(t) === i);
}

export function getEncoder(
  typeUri: string,
  types: Record<string, TypeSchema>,
  variable: string,
  optionsVariable: string,
): string {
  if (typeUri in scalarTypes) return scalarTypes[typeUri].encoder(variable);
  if (typeUri in types) return `await ${variable}.toJsonLd(${optionsVariable})`;
  throw new Error(`Unknown type: ${typeUri}`);
}

export function getTypeGuard(
  typeUri: string,
  types: Record<string, TypeSchema>,
  variable: string,
): string {
  if (typeUri in scalarTypes) return scalarTypes[typeUri].typeGuard(variable);
  if (typeUri in types) return `${variable} instanceof ${types[typeUri].name}`;
  throw new Error(`Unknown type: ${typeUri}`);
}

export function* getEncoders(
  typeUris: string[],
  types: Record<string, TypeSchema>,
  variable: string,
  optionsVariable: string,
): Iterable<string> {
  let i = typeUris.length;
  for (const typeUri of typeUris) {
    if (--i > 0) {
      yield getTypeGuard(typeUri, types, variable);
      yield " ? ";
    }
    yield getEncoder(typeUri, types, variable, optionsVariable);
    if (i > 0) yield " : ";
  }
}

export function getDecoder(
  typeUri: string,
  types: Record<string, TypeSchema>,
  variable: string,
  optionsVariable: string,
): string {
  if (typeUri in scalarTypes) return scalarTypes[typeUri].decoder(variable);
  if (typeUri in types) {
    return `await ${types[typeUri].name}.fromJsonLd(
      ${variable}, ${optionsVariable})`;
  }
  throw new Error(`Unknown type: ${typeUri}`);
}

export function getDataCheck(
  typeUri: string,
  types: Record<string, TypeSchema>,
  variable: string,
): string {
  if (typeUri in scalarTypes) return scalarTypes[typeUri].dataCheck(variable);
  if (typeUri in types) {
    const subtypes = getSubtypes(typeUri, types);
    return `typeof ${variable} === "object" && "@type" in ${variable}
      && Array.isArray(${variable}["@type"])` +
      (subtypes.length > 1
        ? `&& ${JSON.stringify(subtypes)}.some(
            t => ${variable}["@type"].includes(t))`
        : `&& ${variable}["@type"].includes(${JSON.stringify(typeUri)})`);
  }
  throw new Error(`Unknown type: ${typeUri}`);
}

export function* getDecoders(
  typeUris: string[],
  types: Record<string, TypeSchema>,
  variable: string,
  optionsVariable: string,
): Iterable<string> {
  for (const typeUri of typeUris) {
    yield getDataCheck(typeUri, types, variable);
    yield " ? ";
    yield getDecoder(typeUri, types, variable, optionsVariable);
    yield " : ";
  }
  yield "undefined";
}
