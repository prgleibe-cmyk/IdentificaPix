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
    name: "Caixa Econômica Federal",
    formats: [],
    active: true
  },
  {
    key: "banco_do_brasil",
    name: "Banco do Brasil",
    formats: [],
    active: true
  },
  {
    key: "itau",
    name: "Itaú Unibanco",
    formats: [],
    active: true
  },
  {
    key: "bradesco",
    name: "Banco Bradesco",
    formats: [],
    active: true
  },
  {
    key: "santander",
    name: "Banco Santander",
    formats: [],
    active: true
  },
  {
    key: "nubank",
    name: "Nubank (Nu Pagamentos)",
    formats: [],
    active: true
  },
  {
    key: "inter",
    name: "Banco Inter",
    formats: [],
    active: true
  },
  {
    key: "mercado_pago",
    name: "Mercado Pago",
    formats: [],
    active: true
  },
  {
    key: "c6_bank",
    name: "C6 Bank",
    formats: [],
    active: true
  },
  {
    key: "pagbank",
    name: "PagBank / PagSeguro",
    formats: [],
    active: true
  }
];
