export type StorageCategory = {
  slug: string;
  label: string;
  description: string;
};

export const DEFAULT_CATEGORY_SLUG = "geral";

export const STORAGE_CATEGORIES: StorageCategory[] = [
  {
    slug: DEFAULT_CATEGORY_SLUG,
    label: "Geral",
    description: "Arquivos que nao precisam de uma pasta especifica."
  },
  {
    slug: "checklists",
    label: "Checklists",
    description: "Auditorias, listas de verificacao e evidencias operacionais."
  },
  {
    slug: "relatorios",
    label: "Relatorios",
    description: "Analises, demonstrativos e documentos consolidados."
  },
  {
    slug: "contratos",
    label: "Contratos",
    description: "Acordos, termos, propostas e documentos assinados."
  },
  {
    slug: "financeiro",
    label: "Financeiro",
    description: "Notas, comprovantes e documentos de cobranca."
  },
  {
    slug: "imagens",
    label: "Imagens",
    description: "Fotos, prints e arquivos visuais."
  },
  {
    slug: "outros",
    label: "Outros",
    description: "Materiais avulsos ou temporarios."
  }
];

export function getStorageCategories() {
  return STORAGE_CATEGORIES;
}

export function normalizeCategorySlug(value?: string | null) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return STORAGE_CATEGORIES.some((category) => category.slug === normalized) ? normalized : DEFAULT_CATEGORY_SLUG;
}

export function getCategoryBySlug(value?: string | null) {
  const slug = normalizeCategorySlug(value);

  return STORAGE_CATEGORIES.find((category) => category.slug === slug) ?? STORAGE_CATEGORIES[0];
}

export function getCategoryFromStoragePath(path: string) {
  const [, maybeCategory] = path.split("/");

  return getCategoryBySlug(maybeCategory);
}
