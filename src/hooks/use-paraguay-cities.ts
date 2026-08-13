import { useQuery } from "@tanstack/react-query";
import { PARAGUAY_DEPARTMENTS } from "@/lib/paraguay-locations";

/**
 * Retorna a lista de cidades de um departamento do Paraguai.
 * Mantém o mesmo shape do useIBGECities para ser intercambiável.
 */
export function useParaguayCities(departmentValue: string) {
  return useQuery({
    queryKey: ["paraguay-cities", departmentValue],
    queryFn: async () => {
      if (!departmentValue) return [] as string[];
      const dep = PARAGUAY_DEPARTMENTS.find((d) => d.value === departmentValue);
      const cities = dep ? [...dep.cities] : [];
      return cities.sort((a, b) => a.localeCompare(b));
    },
    enabled: !!departmentValue,
    staleTime: Infinity,
  });
}
