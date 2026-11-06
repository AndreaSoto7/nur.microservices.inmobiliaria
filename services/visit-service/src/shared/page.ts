export type PageFilter = {
  page: number;
  size: number;
  sort: 'asc' | 'desc';
  propertyId?: string;
};

export type Page<T> = {
  data: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
};
