import { useQuery } from "@tanstack/react-query";

interface IBGEMunicipio {
  nome: string;
}

export function useIBGECities(uf: string) {
  return useQuery({
    queryKey: ["ibge-cities", uf],
    queryFn: async () => {
      if (!uf) return [];
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
      );
      if (!res.ok) throw new Error("Erro ao buscar cidades");
      const data: IBGEMunicipio[] = await res.json();
      return data.map((m) => m.nome).sort((a, b) => a.localeCompare(b));
    },
    enabled: !!uf,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
}
