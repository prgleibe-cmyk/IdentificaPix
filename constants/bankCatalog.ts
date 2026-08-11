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
    formats: [".ofx"],
    active: true
  },
  {
    key: "sicredi",
    name: "Sicredi",
    formats: [".ofx"],
    active: true
  },
  {
    key: "caixa",
    name: "Caixa Econômica Federal",
    formats: [".ofx"],
    active: false
  },
  {
    key: "banco_do_brasil",
    name: "Banco do Brasil",
    formats: [".ofx"],
    active: false
  },
  {
    key: "itau",
    name: "Itaú Unibanco",
    formats: [".ofx"],
    active: false
  },
  {
    key: "bradesco",
    name: "Banco Bradesco",
    formats: [".ofx"],
    active: false
  },
  {
    key: "santander",
    name: "Banco Santander",
    formats: [".ofx"],
    active: false
  },
  {
    key: "nubank",
    name: "Nubank (Nu Pagamentos)",
    formats: [".ofx"],
    active: false
  },
  {
    key: "inter",
    name: "Banco Inter",
    formats: [".ofx"],
    active: false
  },
  {
    key: "mercado_pago",
    name: "Mercado Pago",
    formats: [".ofx"],
    active: false
  },
  {
    key: "c6_bank",
    name: "C6 Bank",
    formats: [".ofx"],
    active: false
  },
  {
    key: "pagbank",
    name: "PagBank / PagSeguro",
    formats: [".ofx"],
    active: false
  }
];
