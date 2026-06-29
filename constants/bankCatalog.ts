export interface BankCatalogItem {
  key: string;
  name: string;
  formats: string[];
  active: boolean;
}

export const BANK_CATALOG: BankCatalogItem[] = [
  {
    key: "sicoob",
    name: "Sicoob",
    formats: [],
    active: true
  },
  {
    key: "sicredi",
    name: "Sicredi",
    formats: [],
    active: true
  },
  {
    key: "caixa",
    name: "Caixa",
    formats: [],
    active: false
  },
  {
    key: "banco_do_brasil",
    name: "Banco do Brasil",
    formats: [],
    active: false
  },
  {
    key: "itau",
    name: "Itaú",
    formats: [],
    active: false
  },
  {
    key: "bradesco",
    name: "Bradesco",
    formats: [],
    active: false
  },
  {
    key: "nubank",
    name: "Nubank",
    formats: [],
    active: false
  }
];
