export type BuildAddressStringParams = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country?: string;
};

export function buildAddressString({
  street,
  houseNumber,
  postalCode,
  city,
  country = "Deutschland",
}: BuildAddressStringParams): string {
  const trimmedStreet = street.trim();
  const trimmedHouseNumber = houseNumber.trim();
  const trimmedPostalCode = postalCode.trim();
  const trimmedCity = city.trim();

  if (
    !trimmedStreet ||
    !trimmedHouseNumber ||
    !trimmedPostalCode ||
    !trimmedCity
  ) {
    return "";
  }

  return `${trimmedStreet} ${trimmedHouseNumber}, ${trimmedPostalCode} ${trimmedCity}, ${country}`;
}
