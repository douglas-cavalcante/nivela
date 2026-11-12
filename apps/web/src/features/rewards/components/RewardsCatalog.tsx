import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  TextField,
} from "@mui/material";
import { parseApiError } from "@nivela/api-contract";
import type { ApiReward } from "@nivela/api-contract";
import { useState } from "react";
import { ConfirmDialog } from "src/components/ConfirmDialog";
import { EmptyState } from "src/components/EmptyState";
import { SearchField } from "src/components/SearchField";
import {
  listRewardsAction,
  setRewardStatusAction,
} from "src/features/rewards/api/rewards.action";
import { RewardCard } from "src/features/rewards/components/RewardCard";
import { RewardFormDialog } from "src/features/rewards/components/RewardFormDialog";
import { useListQuery } from "src/hooks/useListQuery";
import { usePaginatedList } from "src/hooks/usePaginatedList";
import { useNotify } from "src/lib/notify/useNotify";

const paginationLabel = (
  type: string,
  page: number | null,
  selected: boolean,
): string => {
  if (type === "page")
    return selected ? `Página ${page}, atual` : `Ir para a página ${page}`;
  if (type === "first") return "Ir para a primeira página";
  if (type === "last") return "Ir para a última página";
  if (type === "next") return "Ir para a próxima página";
  return "Ir para a página anterior";
};

/** Aba "Prêmios": grade de cartões com busca e situação na URL, criação, edição e (des)ativação. */
export function RewardsCatalog() {
  const notify = useNotify();
  // `'new'`: prêmio novo; um prêmio: edição
  const [form, setForm] = useState<ApiReward | "new" | null>(null);
  const [toggling, setToggling] = useState<ApiReward | null>(null);
  const [saving, setSaving] = useState(false);
  const { page, filters, setPage, setFilters } = useListQuery({
    search: "",
    status: "",
  });
  const search = filters.search.trim();
  const status =
    filters.status === "active" || filters.status === "inactive"
      ? filters.status
      : "";

  const { rows, meta, loading, error, reload } = usePaginatedList(
    (signal) =>
      listRewardsAction(
        {
          page: page > 1 ? page : undefined,
          search: search || undefined,
          status: status || undefined,
        },
        signal,
      ),
    JSON.stringify([page, search, status]),
  );

  async function changeStatus(reward: ApiReward) {
    const activate = !reward.active;
    setSaving(true);
    try {
      await setRewardStatusAction(reward.id, activate);
      notify.success(activate ? "Prêmio ativado." : "Prêmio desativado.");
      await reload();
    } catch (err) {
      notify.error(parseApiError(err).message);
    } finally {
      setSaving(false);
      setToggling(null);
    }
  }

  function askToggle(reward: ApiReward) {
    if (!reward.active)
      void changeStatus(reward); // ativar não precisa de confirmação
    else setToggling(reward);
  }

  const filtered = Boolean(search || status);

  let content;
  if (error) {
    content = (
      <EmptyState
        title="Não deu para carregar."
        description={error}
        action={
          <Button variant="contained" onClick={() => void reload()}>
            Tentar de novo
          </Button>
        }
      />
    );
  } else if (loading && rows.length === 0) {
    content = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress aria-label="Carregando" />
      </Box>
    );
  } else if (rows.length === 0) {
    content =
      meta && meta.page > 1 ? (
        <EmptyState
          title="Esta página está vazia."
          description="Não há prêmios nesta página."
          action={
            <Button variant="contained" onClick={() => setPage(1)}>
              Voltar para a primeira página
            </Button>
          }
        />
      ) : (
        <EmptyState
          title={
            filtered ? "Nenhum prêmio encontrado." : "Nenhum prêmio ainda."
          }
          description={
            filtered
              ? "Tente outra busca ou limpe os filtros."
              : "Cadastre o primeiro prêmio para abrir a loja."
          }
        />
      );
  } else {
    content = (
      <Box
        aria-busy={loading}
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
          },
          opacity: loading ? 0.6 : 1,
          transition: "opacity 120ms ease",
        }}
      >
        {rows.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            busy={saving}
            onEdit={() => setForm(reward)}
            onToggle={() => askToggle(reward)}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="Catálogo de prêmios">
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <SearchField
            label="Buscar prêmio"
            value={filters.search}
            onChange={(value) => setFilters({ search: value })}
          />
          <TextField
            select
            size="small"
            label="Situação"
            value={status}
            onChange={(event) => setFilters({ status: event.target.value })}
            slotProps={{
              inputLabel: { shrink: true },
              select: { displayEmpty: true },
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="active">Ativos</MenuItem>
            <MenuItem value="inactive">Inativos</MenuItem>
          </TextField>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setForm("new")}
        >
          Novo prêmio
        </Button>
      </Box>

      {content}

      {meta && meta.last_page > 1 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={meta.last_page}
            page={meta.page}
            showFirstButton
            showLastButton
            getItemAriaLabel={paginationLabel}
            onChange={(_event, next) => setPage(next)}
          />
        </Box>
      ) : null}

      {form !== null ? (
        <RewardFormDialog
          reward={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={(_saved, created) => {
            notify.success(
              created
                ? "Prêmio criado. Agora você pode adicionar uma imagem."
                : "Prêmio salvo.",
            );
            void reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={toggling !== null}
        title="Desativar o prêmio?"
        description="Prêmios inativos somem da loja do aluno."
        confirmLabel="Desativar"
        tone="danger"
        loading={saving}
        onConfirm={() => {
          if (toggling) void changeStatus(toggling);
        }}
        onClose={() => setToggling(null)}
      />
    </Box>
  );
}
