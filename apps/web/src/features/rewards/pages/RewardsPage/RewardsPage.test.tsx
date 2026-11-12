import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Route, Routes, useLocation } from "react-router";
import { RewardsPage } from "src/features/rewards/pages/RewardsPage";
import { NotifyProvider } from "src/lib/notify/NotifyProvider";
import { renderWithProviders } from "src/test/render";
import { API_URL, server } from "src/test/server";
import { admin, teacher } from "src/test/users";

const reward = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Prêmio ${id}`,
  description: null,
  image_url: null,
  price: 50,
  stock: 3,
  active: true,
  created_by: { id: 2, name: "Paulo Professor" },
  can_edit: true,
  pending_redemptions: 0,
  updated_at: "2026-11-08T10:00:00.000Z",
  ...extra,
});

const redemption = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  reward: { id: 1, name: "Caderno especial", image_url: null },
  price_paid: 80,
  status: "pending",
  rejection_reason: null,
  created_at: "2026-11-10T14:05:00.000Z",
  handled_at: null,
  student: {
    id: 5,
    name: `Aluna ${id}`,
    classrooms: [{ id: 3, name: "7º A" }],
  },
  handled_by: null,
  ...extra,
});

const meta = (total: number, page = 1) => ({
  page,
  per_page: 15,
  total,
  last_page: Math.max(1, Math.ceil(total / 15)),
});

function Where() {
  const location = useLocation();
  return (
    <output aria-label="url">{location.pathname + location.search}</output>
  );
}

function renderPage(route = "/loja", user = teacher) {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/loja" element={<RewardsPage />} />
      </Routes>
      <Where />
    </NotifyProvider>,
    { user, route },
  );
}

const url = () => screen.getByLabelText("url").textContent ?? "";

function catalog(
  rows: unknown[] = [
    reward(1),
    reward(2, {
      name: "Boné",
      price: 1,
      stock: 0,
      active: false,
      pending_redemptions: 2,
    }),
  ],
  onList?: (params: URLSearchParams) => void,
) {
  server.use(
    http.get(`${API_URL}/rewards`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      onList?.(params);
      return HttpResponse.json({ data: rows, meta: meta(rows.length) });
    }),
  );
}

function queue(
  rows: unknown[] = [redemption(1)],
  onList?: (params: URLSearchParams) => void,
) {
  server.use(
    http.get(`${API_URL}/classrooms`, () =>
      HttpResponse.json({ data: [{ id: 3, name: "7º A" }], meta: meta(1) }),
    ),
    http.get(`${API_URL}/redemptions`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      onList?.(params);
      return HttpResponse.json({ data: rows, meta: meta(rows.length) });
    }),
  );
}

describe("RewardsPage: catálogo", () => {
  it("mostra os prêmios em cartões com preço, estoque, situação e resgates pendentes", async () => {
    catalog();
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Loja de prêmios" }),
    ).toBeInTheDocument();
    const first = (await screen.findByText("Prêmio 1")).closest(
      "article",
    ) as HTMLElement;
    expect(within(first).getByText("50 moedas.")).toBeInTheDocument();
    expect(within(first).getByText("Estoque: 3.")).toBeInTheDocument();
    expect(within(first).getByText("Ativo")).toBeInTheDocument();
    expect(
      within(first).getByText("Nenhum resgate pendente."),
    ).toBeInTheDocument();
    const second = screen.getByText("Boné").closest("article") as HTMLElement;
    expect(within(second).getByText("1 moeda.")).toBeInTheDocument();
    expect(within(second).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(second).getByText("2 resgates pendentes."),
    ).toBeInTheDocument();
  });

  it("busca e situação ficam na URL e vão para a API", async () => {
    const calls: URLSearchParams[] = [];
    catalog(undefined, (params) => calls.push(params));
    renderPage("/loja?search=bon&status=inactive");

    await screen.findByText("Prêmio 1");
    expect(calls[0].get("search")).toBe("bon");
    expect(calls[0].get("status")).toBe("inactive");

    await userEvent.click(screen.getByRole("combobox", { name: "Situação" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Ativos" }),
    );
    await waitFor(() => expect(url()).toContain("status=active"));
    await waitFor(() => expect(calls.at(-1)?.get("status")).toBe("active"));
  });

  it("cria um prêmio com o corpo certo e libera a imagem em seguida", async () => {
    catalog([]);
    let body: unknown;
    server.use(
      http.post(`${API_URL}/rewards`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(reward(9, { name: "Caneta" }), {
          status: 201,
        });
      }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Novo prêmio" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Novo prêmio" });
    expect(
      within(dialog).getByText("Salve o prêmio para adicionar uma imagem."),
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Nome"), "Caneta");
    await userEvent.type(within(dialog).getByLabelText("Preço (moedas)"), "50");
    await userEvent.type(within(dialog).getByLabelText("Estoque"), "3");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Criar prêmio" }),
    );

    await waitFor(() =>
      expect(body).toEqual({
        name: "Caneta",
        description: null,
        price: 50,
        stock: 3,
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Editar prêmio" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Adicionar imagem" }),
    ).toBeInTheDocument();
  });

  it("mostra os erros 422 nos campos", async () => {
    catalog([]);
    server.use(
      http.post(`${API_URL}/rewards`, () =>
        HttpResponse.json(
          {
            message: "Dados inválidos.",
            errors: {
              price: ["O preço deve ser um número inteiro de 1 a 100000."],
            },
          },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Novo prêmio" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Novo prêmio" });
    await userEvent.type(within(dialog).getByLabelText("Nome"), "Caneta");
    await userEvent.type(within(dialog).getByLabelText("Preço (moedas)"), "50");
    await userEvent.type(within(dialog).getByLabelText("Estoque"), "3");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Criar prêmio" }),
    );

    expect(
      await within(dialog).findByText(
        "O preço deve ser um número inteiro de 1 a 100000.",
      ),
    ).toBeInTheDocument();
  });

  it("valida o formulário antes de enviar", async () => {
    catalog([]);
    const post = vi.fn();
    server.use(http.post(`${API_URL}/rewards`, () => post()));
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Novo prêmio" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Novo prêmio" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Criar prêmio" }),
    );

    expect(
      await within(dialog).findByText("Informe o nome do prêmio."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "O preço deve ser um número inteiro de 1 a 100000.",
      ),
    ).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("edita um prêmio com o formulário preenchido", async () => {
    catalog([reward(1, { description: "Azul" })]);
    let body: unknown;
    server.use(
      http.put(`${API_URL}/rewards/1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(reward(1));
      }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Editar Prêmio 1" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editar prêmio" });
    expect(within(dialog).getByLabelText("Descrição (opcional)")).toHaveValue(
      "Azul",
    );
    const stock = within(dialog).getByLabelText("Estoque");
    await userEvent.clear(stock);
    await userEvent.type(stock, "9");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );

    await waitFor(() =>
      expect(body).toEqual({
        name: "Prêmio 1",
        description: "Azul",
        price: 50,
        stock: 9,
      }),
    );
  });

  it("na edição, só envia o estoque se o campo foi alterado", async () => {
    catalog([reward(1)]);
    const bodies: unknown[] = [];
    server.use(
      http.put(`${API_URL}/rewards/1`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(reward(1));
      }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Editar Prêmio 1" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editar prêmio" });
    const name = within(dialog).getByLabelText("Nome");
    await userEvent.clear(name);
    await userEvent.type(name, "Novo nome");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      name: "Novo nome",
      description: null,
      price: 50,
    });

    const stock = within(dialog).getByLabelText("Estoque");
    await userEvent.clear(stock);
    await userEvent.type(stock, "8");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar" }),
    );
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      name: "Novo nome",
      description: null,
      price: 50,
      stock: 8,
    });
  });

  it("o professor só vê as ações dos prêmios que pode editar", async () => {
    catalog([
      reward(1),
      reward(2, {
        can_edit: false,
        created_by: { id: 9, name: "Outra Pessoa" },
      }),
    ]);
    renderPage();

    await screen.findByText("Prêmio 2");
    expect(
      screen.getByRole("button", { name: "Editar Prêmio 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar Prêmio 2" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Desativar Prêmio 2" }),
    ).toBeNull();
  });

  it("desativar pede confirmação e envia a situação; ativar não pede", async () => {
    catalog([reward(1), reward(2, { active: false })]);
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API_URL}/rewards/:id/status`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(reward(1, { active: false }));
      }),
    );
    renderPage("/loja", admin);

    await userEvent.click(
      await screen.findByRole("button", { name: "Desativar Prêmio 1" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Desativar o prêmio?",
    });
    expect(
      within(dialog).getByText("Prêmios inativos somem da loja do aluno."),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Desativar" }),
    );
    await waitFor(() => expect(bodies).toEqual([{ active: false }]));

    await userEvent.click(
      await screen.findByRole("button", { name: "Ativar Prêmio 2" }),
    );
    await waitFor(() =>
      expect(bodies).toEqual([{ active: false }, { active: true }]),
    );
  });

  it("sem prêmios mostra o estado vazio", async () => {
    catalog([]);
    renderPage();
    expect(await screen.findByText("Nenhum prêmio ainda.")).toBeInTheDocument();
  });
});

describe("RewardsPage: abas", () => {
  it("abre a aba pela URL e troca de aba escrevendo na URL", async () => {
    catalog();
    queue();
    renderPage("/loja?tab=resgates");

    expect(
      await screen.findByRole("tab", { name: "Resgates", selected: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Aluna 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Prêmios" }));
    expect(await screen.findByText("Prêmio 1")).toBeInTheDocument();
    expect(url()).toBe("/loja");

    await userEvent.click(screen.getByRole("tab", { name: "Resgates" }));
    await waitFor(() => expect(url()).toBe("/loja?tab=resgates"));
  });

  it("uma aba desconhecida cai em Prêmios", async () => {
    catalog();
    renderPage("/loja?tab=xyz");
    expect(
      await screen.findByRole("tab", { name: "Prêmios", selected: true }),
    ).toBeInTheDocument();
  });
});

describe("RewardsPage: resgates", () => {
  it("pede a fila de pendentes e mostra aluno, turmas, prêmio, moedas e data", async () => {
    const calls: URLSearchParams[] = [];
    queue(undefined, (params) => calls.push(params));
    renderPage("/loja?tab=resgates");

    const row = (await screen.findByText("Aluna 1")).closest(
      "tr",
    ) as HTMLElement;
    expect(calls[0].get("status")).toBe("pending");
    expect(within(row).getByText("7º A")).toBeInTheDocument();
    expect(within(row).getByText("Caderno especial")).toBeInTheDocument();
    expect(within(row).getByText("80")).toBeInTheDocument();
    expect(
      within(row).getByText(/^10\/11\/2026 \d{2}:\d{2}$/),
    ).toBeInTheDocument();
    expect(within(row).getByText("Pendente")).toBeInTheDocument();
  });

  it("filtra por situação e turma, tudo na URL", async () => {
    const calls: URLSearchParams[] = [];
    queue(undefined, (params) => calls.push(params));
    renderPage("/loja?tab=resgates");
    await screen.findByText("Aluna 1");

    await userEvent.click(screen.getByRole("combobox", { name: "Situação" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Entregues" }),
    );
    await waitFor(() => expect(calls.at(-1)?.get("status")).toBe("delivered"));
    expect(url()).toContain("status=delivered");

    await userEvent.click(screen.getByRole("combobox", { name: "Turma" }));
    await userEvent.click(await screen.findByRole("option", { name: "7º A" }));
    await waitFor(() => expect(calls.at(-1)?.get("classroom_id")).toBe("3"));
    expect(url()).toContain("classroom_id=3");
  });

  it("entregar confirma, chama a rota e recarrega a fila", async () => {
    let delivered = false;
    server.use(
      http.get(`${API_URL}/redemptions`, () =>
        HttpResponse.json({
          data: delivered ? [] : [redemption(1)],
          meta: meta(delivered ? 0 : 1),
        }),
      ),
      http.post(`${API_URL}/redemptions/1/deliver`, () => {
        delivered = true;
        return HttpResponse.json(redemption(1, { status: "delivered" }));
      }),
    );
    renderPage("/loja?tab=resgates");

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Entregar o resgate de Aluna 1",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Entregar o prêmio?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Entregar" }),
    );

    expect(await screen.findByText("Prêmio entregue.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Aluna 1")).toBeNull());
  });

  it("recusar sem motivo não envia; com motivo envia", async () => {
    queue();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/redemptions/1/reject`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(redemption(1, { status: "rejected" }));
      }),
    );
    renderPage("/loja?tab=resgates");

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Recusar o resgate de Aluna 1",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Recusar o resgate?",
    });
    expect(
      within(dialog).getByText("O aluno recebe as moedas de volta."),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Recusar" }),
    );
    expect(
      await within(dialog).findByText(
        "O motivo deve ter de 3 a 300 caracteres.",
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await userEvent.type(
      within(dialog).getByLabelText("Motivo"),
      "Fora de estoque",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Recusar" }),
    );
    await waitFor(() =>
      expect(bodies).toEqual([{ reason: "Fora de estoque" }]),
    );
    expect(await screen.findByText("Resgate recusado.")).toBeInTheDocument();
  });

  it("409 vira aviso e a fila é recarregada", async () => {
    let lists = 0;
    server.use(
      http.get(`${API_URL}/redemptions`, () => {
        lists += 1;
        return HttpResponse.json({ data: [redemption(1)], meta: meta(1) });
      }),
      http.post(`${API_URL}/redemptions/1/deliver`, () =>
        HttpResponse.json(
          { message: "Este resgate já foi finalizado." },
          { status: 409 },
        ),
      ),
    );
    renderPage("/loja?tab=resgates");

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Entregar o resgate de Aluna 1",
      }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Entregar",
      }),
    );

    expect(
      await screen.findByText("Este resgate já foi finalizado."),
    ).toBeInTheDocument();
    await waitFor(() => expect(lists).toBe(2));
  });

  it("resgates já tratados não têm ações e o recusado mostra o motivo", async () => {
    queue([
      redemption(1, {
        status: "rejected",
        rejection_reason: "Fora de estoque",
        handled_at: "2026-11-10T15:00:00.000Z",
      }),
    ]);
    renderPage("/loja?tab=resgates&status=rejected");

    const row = (await screen.findByText("Aluna 1")).closest(
      "tr",
    ) as HTMLElement;
    expect(within(row).getByText("Recusado")).toBeInTheDocument();
    expect(within(row).getByText("Fora de estoque")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("fila vazia mostra o estado vazio", async () => {
    queue([]);
    renderPage("/loja?tab=resgates");
    expect(
      await screen.findByText("Nenhum resgate pendente."),
    ).toBeInTheDocument();
  });
});
