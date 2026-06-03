export type Category = string;

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  salePriceCents?: number;
  category: Category;
  images: string[];
  stock: number;
  clicks: number;
  sold: number;
  isHidden?: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

export type OrderItem = {
  productId: string;
  quantity: number;
};
