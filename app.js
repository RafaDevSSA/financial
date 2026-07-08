/* ==========================================================================
   Quita Aí — lógica da aplicação (JS puro)
   Estado persistido no localStorage. Nenhuma dependência externa.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Constantes ---------- */
  const CHAVE_STORAGE = "quitaAi:v1";

  const ETAPAS = [
    { min: 0,   nome: "Noite",      mensagem: "Toda jornada começa no escuro. O primeiro pagamento já acende o horizonte." },
    { min: 10,  nome: "Madrugada",  mensagem: "As estrelas começam a se apagar. Você já saiu do zero — siga em frente." },
    { min: 30,  nome: "Amanhecer",  mensagem: "O sol está nascendo. Quase um terço do caminho ficou para trás." },
    { min: 55,  nome: "Manhã",      mensagem: "Mais da metade quitada! O dia está cada vez mais claro." },
    { min: 80,  nome: "Quase lá",   mensagem: "A reta final. Cada pagamento agora vale ouro — não solte o ritmo." },
    { min: 100, nome: "Dia claro",  mensagem: "🎉 Dívidas quitadas! Você chegou à liberdade financeira. Aproveite a vista." },
  ];

  const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const formatadorMes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const formatadorDia = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  /* ---------- Estado ---------- */
  let estado = { dividas: [] };
  let idDividaEmPagamento = null;
  let idDividaEmEdicao = null; // null = modal em modo "nova dívida"

  /* ---------- Persistência ---------- */
  function carregarEstado() {
    try {
      const bruto = localStorage.getItem(CHAVE_STORAGE);
      if (bruto) {
        const dados = JSON.parse(bruto);
        if (dados && Array.isArray(dados.dividas)) estado = dados;
      }
    } catch (erro) {
      console.error("Falha ao carregar dados salvos:", erro);
    }
  }

  function salvarEstado() {
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado));
    } catch (erro) {
      console.error("Falha ao salvar dados:", erro);
    }
  }

  /* ---------- Cálculos derivados ---------- */
  function totalPagoDaDivida(divida) {
    return divida.pagamentos.reduce((soma, p) => soma + p.valor, 0);
  }

  function saldoDaDivida(divida) {
    return Math.max(divida.valorTotal - totalPagoDaDivida(divida), 0);
  }

  function resumoGeral() {
    const totalOriginal = estado.dividas.reduce((s, d) => s + d.valorTotal, 0);
    const totalPago = estado.dividas.reduce((s, d) => s + Math.min(totalPagoDaDivida(d), d.valorTotal), 0);
    const restante = Math.max(totalOriginal - totalPago, 0);
    const percentual = totalOriginal > 0 ? (totalPago / totalOriginal) * 100 : 0;

    const agora = new Date();
    const pagoNoMes = estado.dividas
      .flatMap((d) => d.pagamentos)
      .filter((p) => {
        const data = new Date(p.data);
        return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
      })
      .reduce((s, p) => s + p.valor, 0);

    return { totalOriginal, totalPago, restante, percentual, pagoNoMes };
  }

  function etapaAtual(percentual) {
    let indice = 0;
    ETAPAS.forEach((etapa, i) => {
      if (percentual >= etapa.min) indice = i;
    });
    return indice;
  }

  /* ---------- Elementos ---------- */
  const el = {
    corpo: document.body,
    sol: document.getElementById("sol"),
    estrelas: document.getElementById("estrelas"),
    etapaNome: document.getElementById("etapaNome"),
    valorRestante: document.getElementById("valorRestante"),
    mensagem: document.getElementById("mensagemMotivacional"),
    percentualQuitado: document.getElementById("percentualQuitado"),
    barraProgresso: document.getElementById("barraProgresso"),
    preenchimento: document.getElementById("preenchimentoProgresso"),
    totalOriginal: document.getElementById("totalOriginal"),
    totalPago: document.getElementById("totalPago"),
    pagoNoMes: document.getElementById("pagoNoMes"),
    listaDividas: document.getElementById("listaDividas"),
    estadoVazio: document.getElementById("estadoVazio"),
    botaoNovaDivida: document.getElementById("botaoNovaDivida"),
    botaoLimparTudo: document.getElementById("botaoLimparTudo"),
    listaHistorico: document.getElementById("listaHistorico"),
    historicoVazio: document.getElementById("historicoVazio"),
    // Modal de dívida (criação e edição)
    tituloModalDivida: document.getElementById("tituloModalDivida"),
    modalNovaDivida: document.getElementById("modalNovaDivida"),
    entradaNome: document.getElementById("entradaNomeDivida"),
    entradaValor: document.getElementById("entradaValorDivida"),
    botaoSalvarDivida: document.getElementById("botaoSalvarDivida"),
    botaoCancelarDivida: document.getElementById("botaoCancelarDivida"),
    // Modal pagamento
    modalPagamento: document.getElementById("modalPagamento"),
    pagamentoNomeDivida: document.getElementById("pagamentoNomeDivida"),
    pagamentoSaldoAjuda: document.getElementById("pagamentoSaldoAjuda"),
    entradaValorPagamento: document.getElementById("entradaValorPagamento"),
    botaoConfirmarPagamento: document.getElementById("botaoConfirmarPagamento"),
    botaoCancelarPagamento: document.getElementById("botaoCancelarPagamento"),
  };

  /* ---------- Renderização ---------- */
  function renderizarCena(percentual, indiceEtapa) {
    el.corpo.dataset.etapa = String(indiceEtapa);

    // O sol sobe conforme o percentual: cy 360 (horizonte) → 110 (alto do céu)
    const cyInicial = 360;
    const cyFinal = 110;
    const cy = cyInicial - (percentual / 100) * (cyInicial - cyFinal);
    el.sol.setAttribute("cy", String(cy));
    el.sol.setAttribute("r", String(90 + (percentual / 100) * 30));

    const etapa = ETAPAS[indiceEtapa];
    el.etapaNome.textContent = etapa.nome;
    el.mensagem.textContent =
      estado.dividas.length === 0
        ? "Cadastre suas dívidas e comece a jornada."
        : etapa.mensagem;
  }

  function renderizarResumo(resumo) {
    el.valorRestante.textContent = formatadorMoeda.format(resumo.restante);
    el.percentualQuitado.textContent = `${resumo.percentual.toFixed(1).replace(".", ",")}%`;
    el.preenchimento.style.width = `${resumo.percentual}%`;
    el.barraProgresso.setAttribute("aria-valuenow", resumo.percentual.toFixed(1));
    el.totalOriginal.textContent = formatadorMoeda.format(resumo.totalOriginal);
    el.totalPago.textContent = formatadorMoeda.format(resumo.totalPago);
    el.pagoNoMes.textContent = formatadorMoeda.format(resumo.pagoNoMes);
  }

  function renderizarDividas() {
    el.listaDividas.innerHTML = "";
    el.estadoVazio.classList.toggle("visivel", estado.dividas.length === 0);

    estado.dividas.forEach((divida) => {
      const pago = Math.min(totalPagoDaDivida(divida), divida.valorTotal);
      const saldo = saldoDaDivida(divida);
      const percentual = divida.valorTotal > 0 ? (pago / divida.valorTotal) * 100 : 0;
      const quitada = saldo <= 0;

      const item = document.createElement("li");
      item.className = "divida" + (quitada ? " divida--quitada" : "");

      const topo = document.createElement("div");
      topo.className = "divida__topo";

      const nome = document.createElement("span");
      nome.className = "divida__nome";
      nome.textContent = divida.nome;
      topo.appendChild(nome);

      if (quitada) {
        const selo = document.createElement("span");
        selo.className = "divida__selo";
        selo.textContent = "Quitada 🎉";
        topo.appendChild(selo);
      }

      const valores = document.createElement("div");
      valores.className = "divida__valores";
      valores.innerHTML =
        `<span>Total: <strong>${formatadorMoeda.format(divida.valorTotal)}</strong></span>` +
        `<span>Pago: <strong>${formatadorMoeda.format(pago)}</strong></span>` +
        `<span>Restante: <strong>${formatadorMoeda.format(saldo)}</strong></span>`;

      const trilha = document.createElement("div");
      trilha.className = "divida__trilha";
      const preenchimento = document.createElement("div");
      preenchimento.className = "divida__preenchimento";
      preenchimento.style.width = `${percentual}%`;
      trilha.appendChild(preenchimento);

      const acoes = document.createElement("div");
      acoes.className = "divida__acoes";

      if (!quitada) {
        const botaoPagar = document.createElement("button");
        botaoPagar.className = "botao botao--primario";
        botaoPagar.textContent = "Registrar pagamento";
        botaoPagar.addEventListener("click", () => abrirModalPagamento(divida.id));
        acoes.appendChild(botaoPagar);
      }

      const botaoEditar = document.createElement("button");
      botaoEditar.className = "botao botao--fantasma";
      botaoEditar.textContent = "Editar";
      botaoEditar.addEventListener("click", () => abrirModalEditarDivida(divida.id));
      acoes.appendChild(botaoEditar);

      const botaoExcluir = document.createElement("button");
      botaoExcluir.className = "botao botao--fantasma botao--perigo";
      botaoExcluir.textContent = "Excluir";
      botaoExcluir.addEventListener("click", () => excluirDivida(divida.id));
      acoes.appendChild(botaoExcluir);

      item.append(topo, valores, trilha, acoes);
      el.listaDividas.appendChild(item);
    });
  }

  function renderizarHistorico() {
    // Achata todos os pagamentos com o nome da dívida e agrupa por "AAAA-MM"
    const pagamentos = estado.dividas.flatMap((divida) =>
      divida.pagamentos.map((p) => ({ ...p, nomeDivida: divida.nome }))
    );

    el.listaHistorico.innerHTML = "";
    el.historicoVazio.classList.toggle("visivel", pagamentos.length === 0);
    if (pagamentos.length === 0) return;

    const grupos = new Map();
    pagamentos.forEach((p) => {
      const data = new Date(p.data);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(p);
    });

    // Meses mais recentes primeiro
    const chavesOrdenadas = [...grupos.keys()].sort((a, b) => b.localeCompare(a));
    const chaveMesAtual = chavesOrdenadas[0];

    chavesOrdenadas.forEach((chave) => {
      const itens = grupos.get(chave).sort((a, b) => new Date(b.data) - new Date(a.data));
      const totalMes = itens.reduce((s, p) => s + p.valor, 0);
      const [ano, mes] = chave.split("-").map(Number);
      const nomeMes = formatadorMes.format(new Date(ano, mes - 1, 1));

      const detalhes = document.createElement("details");
      detalhes.className = "mes";
      detalhes.open = chave === chaveMesAtual; // mês mais recente já aberto

      const resumo = document.createElement("summary");
      resumo.className = "mes__resumo";

      const nome = document.createElement("span");
      nome.className = "mes__nome";
      nome.textContent = nomeMes;

      const total = document.createElement("span");
      total.className = "mes__total";
      total.textContent = formatadorMoeda.format(totalMes);

      resumo.append(nome, total);

      const lista = document.createElement("ul");
      lista.className = "mes__pagamentos";

      itens.forEach((p) => {
        const item = document.createElement("li");
        item.className = "pagamento";

        const descricao = document.createElement("span");
        descricao.className = "pagamento__divida";
        descricao.textContent = p.nomeDivida;

        const dia = document.createElement("span");
        dia.className = "pagamento__data";
        dia.textContent = formatadorDia.format(new Date(p.data));
        descricao.appendChild(dia);

        const valor = document.createElement("span");
        valor.className = "pagamento__valor";
        valor.textContent = formatadorMoeda.format(p.valor);

        item.append(descricao, valor);
        lista.appendChild(item);
      });

      detalhes.append(resumo, lista);
      el.listaHistorico.appendChild(detalhes);
    });
  }

  function renderizar() {
    const resumo = resumoGeral();
    renderizarCena(resumo.percentual, etapaAtual(resumo.percentual));
    renderizarResumo(resumo);
    renderizarDividas();
    renderizarHistorico();
  }

  /* ---------- Ações ---------- */
  function adicionarDivida(nome, valorTotal) {
    estado.dividas.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      nome,
      valorTotal,
      pagamentos: [],
      criadaEm: new Date().toISOString(),
    });
    salvarEstado();
    renderizar();
  }

  function registrarPagamento(idDivida, valor) {
    const divida = estado.dividas.find((d) => d.id === idDivida);
    if (!divida) return;
    divida.pagamentos.push({ valor, data: new Date().toISOString() });
    salvarEstado();
    renderizar();
  }

  function excluirDivida(idDivida) {
    const divida = estado.dividas.find((d) => d.id === idDivida);
    if (!divida) return;
    const confirmado = window.confirm(`Excluir a dívida "${divida.nome}"? Essa ação não pode ser desfeita.`);
    if (!confirmado) return;
    estado.dividas = estado.dividas.filter((d) => d.id !== idDivida);
    salvarEstado();
    renderizar();
  }

  function limparTudo() {
    const confirmado = window.confirm("Apagar TODAS as dívidas e pagamentos deste navegador?");
    if (!confirmado) return;
    estado = { dividas: [] };
    salvarEstado();
    renderizar();
  }

  /* ---------- Modais ---------- */
  function abrirModalNovaDivida() {
    idDividaEmEdicao = null;
    el.tituloModalDivida.textContent = "Nova dívida";
    el.botaoSalvarDivida.textContent = "Salvar dívida";
    el.entradaNome.value = "";
    el.entradaValor.value = "";
    el.modalNovaDivida.showModal();
    el.entradaNome.focus();
  }

  function abrirModalEditarDivida(idDivida) {
    const divida = estado.dividas.find((d) => d.id === idDivida);
    if (!divida) return;

    idDividaEmEdicao = idDivida;
    el.tituloModalDivida.textContent = "Editar dívida";
    el.botaoSalvarDivida.textContent = "Salvar alterações";
    el.entradaNome.value = divida.nome;
    el.entradaValor.value = String(divida.valorTotal);
    el.modalNovaDivida.showModal();
    el.entradaNome.focus();
  }

  function salvarDivida() {
    const nome = el.entradaNome.value.trim();
    const valor = parseFloat(el.entradaValor.value);

    if (!nome) {
      el.entradaNome.focus();
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      el.entradaValor.focus();
      return;
    }

    if (idDividaEmEdicao) {
      const divida = estado.dividas.find((d) => d.id === idDividaEmEdicao);
      if (divida) {
        // O novo total não pode ser menor do que o já pago
        const pago = totalPagoDaDivida(divida);
        if (valor < pago) {
          window.alert(
            `O valor total não pode ser menor do que o já pago ` +
            `(${formatadorMoeda.format(pago)}).`
          );
          el.entradaValor.focus();
          return;
        }
        divida.nome = nome;
        divida.valorTotal = valor;
        salvarEstado();
        renderizar();
      }
      idDividaEmEdicao = null;
    } else {
      adicionarDivida(nome, valor);
    }

    el.modalNovaDivida.close();
  }

  function abrirModalPagamento(idDivida) {
    const divida = estado.dividas.find((d) => d.id === idDivida);
    if (!divida) return;

    idDividaEmPagamento = idDivida;
    el.pagamentoNomeDivida.textContent = divida.nome;
    el.pagamentoSaldoAjuda.textContent =
      `Saldo restante: ${formatadorMoeda.format(saldoDaDivida(divida))}. ` +
      `Valores acima do saldo serão limitados a ele.`;
    el.entradaValorPagamento.value = "";
    el.modalPagamento.showModal();
    el.entradaValorPagamento.focus();
  }

  function confirmarPagamento() {
    const divida = estado.dividas.find((d) => d.id === idDividaEmPagamento);
    if (!divida) return;

    let valor = parseFloat(el.entradaValorPagamento.value);
    if (!Number.isFinite(valor) || valor <= 0) {
      el.entradaValorPagamento.focus();
      return;
    }

    valor = Math.min(valor, saldoDaDivida(divida));
    registrarPagamento(divida.id, valor);
    el.modalPagamento.close();
    idDividaEmPagamento = null;
  }

  /* ---------- Estrelas do céu (geradas uma única vez) ---------- */
  function gerarEstrelas() {
    const fragmento = document.createDocumentFragment();
    for (let i = 0; i < 40; i++) {
      const estrela = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      estrela.setAttribute("cx", String(Math.random() * 1000));
      estrela.setAttribute("cy", String(Math.random() * 220));
      estrela.setAttribute("r", String(0.6 + Math.random() * 1.4));
      fragmento.appendChild(estrela);
    }
    el.estrelas.appendChild(fragmento);
  }

  /* ---------- Eventos ---------- */
  function registrarEventos() {
    el.botaoNovaDivida.addEventListener("click", abrirModalNovaDivida);
    el.botaoSalvarDivida.addEventListener("click", salvarDivida);
    el.botaoCancelarDivida.addEventListener("click", () => {
      idDividaEmEdicao = null;
      el.modalNovaDivida.close();
    });

    el.botaoConfirmarPagamento.addEventListener("click", confirmarPagamento);
    el.botaoCancelarPagamento.addEventListener("click", () => el.modalPagamento.close());

    el.botaoLimparTudo.addEventListener("click", limparTudo);

    // Enter confirma dentro dos modais
    el.entradaValor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") salvarDivida();
    });
    el.entradaValorPagamento.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmarPagamento();
    });
  }

  /* ---------- Inicialização ---------- */
  carregarEstado();
  gerarEstrelas();
  registrarEventos();
  renderizar();
})();
