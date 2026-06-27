import { Phase } from "../types";

export const PHASE_COLORS: Record<Phase, string> = {
  IDLE:         "#F4A261",  // Laranja Caramelo
  REQUIREMENTS: "#219EBC",  // Azul (Análise)
  DESIGN:       "#7209B7",  // Roxo (Arquitetura)
  TASKS:        "#FFB703",  // Amarelo Ouro (Planejamento)
  EXECUTING:    "#E63946",  // Vermelho (Ação Crítica)
};
