const App = {

  state: {
    abaAtual: 'dashboard',
    clientes: [],
    veiculos: [],
    manutencoes: [],
    labQueryAtual: 'join',
    itemParaExcluir: null 
  },

  async init() {
    console.log('[AutoTrack] Inicializando interface gráfica...');
    this.configurarMascaras();
    await this.verificarConexao();
    await this.carregarDadosIniciais();
  },


  async verificarConexao() {
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');

    dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
    text.textContent = 'Verificando MySQL...';

    try {
      const res = await API.health();
      if (res.bancoDeDados && res.bancoDeDados.conectado) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
        text.textContent = `MySQL Conectado (${res.bancoDeDados.database})`;
      } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
        text.textContent = 'MySQL Desconectado';
      }
    } catch (err) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
      text.textContent = 'Servidor Offline';
    }
  },


  navegar(aba) {
    this.state.abaAtual = aba;
    const abas = ['dashboard', 'clientes', 'veiculos', 'manutencoes', 'sql'];

    abas.forEach(nome => {
      const section = document.getElementById(`view-${nome}`);
      const btn = document.getElementById(`nav-${nome}`);

      if (nome === aba) {
        section?.classList.remove('hidden');
        btn?.classList.remove('text-slate-400', 'hover:bg-slate-800');
        btn?.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
      } else {
        section?.classList.add('hidden');
        btn?.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        btn?.classList.add('text-slate-400', 'hover:bg-slate-800');
      }
    });

    
    if (aba === 'dashboard') {
      this.carregarDashboard();
    } else if (aba === 'clientes') {
      this.carregarClientes();
    } else if (aba === 'veiculos') {
      this.carregarVeiculos();
    } else if (aba === 'manutencoes') {
      this.carregarManutencoes();
    } else if (aba === 'sql') {
      this.executarLaboratorioSQL(this.state.labQueryAtual || 'join');
    }
  },


  async carregarDadosIniciais() {
    await this.carregarDashboard();
   
    this.carregarClientes(false);
    this.carregarVeiculos(false);
  },

  
  async carregarDashboard() {
    try {
      // 1. KPIs
      const kpisRes = await API.relatorios.kpis();
      if (kpisRes.success && kpisRes.data) {
        document.getElementById('kpi-clientes').textContent = kpisRes.data.totalClientes;
        document.getElementById('kpi-veiculos').textContent = kpisRes.data.totalVeiculos;
        document.getElementById('kpi-manutencoes').textContent = kpisRes.data.totalManutencoes;
        document.getElementById('kpi-ativas').textContent = kpisRes.data.manutencoesAtivas;
        document.getElementById('kpi-faturamento').textContent = Formatters.moeda(kpisRes.data.faturamentoTotal);
      }

      // 2. Relatórios Obrigatórios
      await Promise.all([
        this.carregarRelatorioAgregacao(),
        this.carregarRelatorioSubquery(),
        this.carregarRelatorioJoin()
      ]);
    } catch (error) {
      console.warn('[Dashboard] Erro ao carregar métricas:', error.message);
    }
  },

  // Query Obrigatória 1: JOIN
  async carregarRelatorioJoin() {
    const tbody = document.getElementById('tbody-relatorio-join');
    try {
      const res = await API.relatorios.join();
      if (!res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-500">Nenhum registro encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = res.data.map(m => `
        <tr class="hover:bg-slate-700/40 transition">
          <td class="py-2.5 px-3 font-mono font-semibold text-blue-400">#${m.manutencao_id}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${m.tipo === 'PREVENTIVA' ? 'badge-preventiva' : 'badge-corretiva'}">
              ${m.tipo}
            </span>
          </td>
          <td class="py-2.5 px-3">
            <div class="font-semibold text-slate-100">${m.marca} ${m.modelo}</div>
            <div class="font-mono text-[11px] text-slate-400">${m.placa} (${m.ano})</div>
          </td>
          <td class="py-2.5 px-3">
            <div class="text-slate-200">${m.proprietario}</div>
            <div class="text-[11px] text-slate-400">${m.telefone}</div>
          </td>
          <td class="py-2.5 px-3 text-slate-300 max-w-xs truncate" title="${m.descricao}">
            ${m.descricao}
          </td>
          <td class="py-2.5 px-3 text-slate-300">${m.data_formatada || Formatters.data(m.data_manutencao)}</td>
          <td class="py-2.5 px-3 text-right font-semibold text-emerald-400">${Formatters.moeda(m.valor)}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold badge-${m.status.toLowerCase()}">
              ${m.status.replace('_', ' ')}
            </span>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-rose-400">Erro ao consultar JOIN: ${error.message}</td></tr>`;
    }
  },

  // Query Obrigatória 2: Agregação com GROUP BY
  async carregarRelatorioAgregacao() {
    const tbody = document.getElementById('tbody-relatorio-agregacao');
    try {
      const res = await API.relatorios.agregacao();
      if (!res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Nenhum veículo encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = res.data.map(v => `
        <tr class="hover:bg-slate-700/40 transition">
          <td class="py-2.5 px-3">
            <div class="font-semibold text-slate-100">${v.marca} ${v.modelo}</div>
            <div class="font-mono text-[11px] text-slate-400">${v.placa}</div>
          </td>
          <td class="py-2.5 px-3 text-slate-300">${v.proprietario}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-bold">${v.total_manutencoes}</span>
          </td>
          <td class="py-2.5 px-3 text-right font-bold text-slate-100">${Formatters.moeda(v.total_gasto)}</td>
          <td class="py-2.5 px-3 text-right text-slate-400">${Formatters.moeda(v.ticket_medio)}</td>
        </tr>
      `).join('');
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-400">Erro na Agregação: ${error.message}</td></tr>`;
    }
  },

  // Query Obrigatória 3: Subquery
  async carregarRelatorioSubquery() {
    const tbody = document.getElementById('tbody-relatorio-subquery');
    const mediaLabel = document.getElementById('subquery-media-label');

    try {
      const res = await API.relatorios.subquery();
      if (res.media_geral_veiculos) {
        mediaLabel.textContent = Formatters.moeda(res.media_geral_veiculos);
      }

      if (!res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-500">Nenhum veículo acima da média encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = res.data.map(v => `
        <tr class="hover:bg-slate-700/40 transition bg-amber-500/5">
          <td class="py-2.5 px-3 font-semibold text-slate-100">${v.veiculo}</td>
          <td class="py-2.5 px-3 font-mono text-amber-400">${v.placa}</td>
          <td class="py-2.5 px-3 text-slate-300">${v.proprietario}</td>
          <td class="py-2.5 px-3 text-center font-bold text-slate-200">${v.qtd_servicos}</td>
          <td class="py-2.5 px-3 text-right font-bold text-amber-400">${Formatters.moeda(v.gasto_acumulado)}</td>
        </tr>
      `).join('');
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-400">Erro na Subquery: ${error.message}</td></tr>`;
    }
  },

  

  async carregarClientes(renderizarTabela = true) {
    try {
      const res = await API.clientes.listar();
      this.state.clientes = res.data || [];
      if (renderizarTabela) this.renderizarTabelaClientes(this.state.clientes);
      this.atualizarSelectClientes();
    } catch (error) {
      Toast.error('Erro ao listar clientes: ' + error.message);
    }
  },

  renderizarTabelaClientes(lista) {
    const tbody = document.getElementById('tbody-clientes');
    if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Nenhum cliente cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = lista.map(c => `
      <tr class="hover:bg-slate-700/30 transition">
        <td class="py-3 px-4 font-mono text-slate-400">#${c.id}</td>
        <td class="py-3 px-4 font-semibold text-slate-100">${c.nome}</td>
        <td class="py-3 px-4 font-mono text-slate-300">${c.cpf}</td>
        <td class="py-3 px-4 text-slate-300">${c.telefone}</td>
        <td class="py-3 px-4 text-slate-300">${c.email}</td>
        <td class="py-3 px-4 text-slate-400 max-w-xs truncate" title="${c.endereco || ''}">${c.endereco || '-'}</td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="App.editarCliente(${c.id})" class="p-1.5 rounded hover:bg-slate-700 text-blue-400 hover:text-blue-300" title="Editar">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="App.solicitarExclusao('cliente', ${c.id}, '${c.nome.replace(/'/g, "\\'")}')" class="p-1.5 rounded hover:bg-slate-700 text-rose-400 hover:text-rose-300" title="Excluir">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  filtrarClientes() {
    const termo = document.getElementById('filtro-cliente').value.toLowerCase();
    const filtrados = this.state.clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) || c.cpf.includes(termo) || c.email.toLowerCase().includes(termo)
    );
    this.renderizarTabelaClientes(filtrados);
  },

  abrirModalCliente(cliente = null) {
    document.getElementById('modal-cliente').classList.remove('hidden');
    const form = document.getElementById('form-cliente');
    form.reset();

    if (cliente) {
      document.getElementById('modal-cliente-titulo').innerHTML = '<i class="fa-solid fa-pen text-blue-400"></i><span>Editar Cliente</span>';
      document.getElementById('cliente-id').value = cliente.id;
      document.getElementById('cliente-nome').value = cliente.nome;
      document.getElementById('cliente-cpf').value = cliente.cpf;
      document.getElementById('cliente-telefone').value = cliente.telefone;
      document.getElementById('cliente-email').value = cliente.email;
      document.getElementById('cliente-endereco').value = cliente.endereco || '';
    } else {
      document.getElementById('modal-cliente-titulo').innerHTML = '<i class="fa-solid fa-user-plus text-blue-400"></i><span>Cadastrar Cliente</span>';
      document.getElementById('cliente-id').value = '';
    }
  },

  fecharModalCliente() {
    document.getElementById('modal-cliente').classList.add('hidden');
  },

  async editarCliente(id) {
    try {
      const res = await API.clientes.buscarPorId(id);
      this.abrirModalCliente(res.data);
    } catch (err) {
      Toast.error('Erro ao buscar dados do cliente: ' + err.message);
    }
  },

  async salvarCliente(e) {
    e.preventDefault();
    const id = document.getElementById('cliente-id').value;
    const dados = {
      nome: document.getElementById('cliente-nome').value,
      cpf: document.getElementById('cliente-cpf').value,
      telefone: document.getElementById('cliente-telefone').value,
      email: document.getElementById('cliente-email').value,
      endereco: document.getElementById('cliente-endereco').value
    };

    try {
      if (id) {
        await API.clientes.atualizar(id, dados);
        Toast.success('Cliente atualizado com sucesso no MySQL!');
      } else {
        await API.clientes.criar(dados);
        Toast.success('Cliente cadastrado com sucesso no MySQL!');
      }

      this.fecharModalCliente();
      await this.carregarClientes();
      await this.carregarDashboard();
    } catch (error) {
      Toast.error(error.message);
    }
  },

  atualizarSelectClientes() {
    const select = document.getElementById('veiculo-cliente-id');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione o proprietário...</option>' +
      this.state.clientes.map(c => `
        <option value="${c.id}">${c.nome} (CPF: ${c.cpf})</option>
      `).join('');
  },

 
  async carregarVeiculos(renderizarTabela = true) {
    try {
      const res = await API.veiculos.listar();
      this.state.veiculos = res.data || [];
      if (renderizarTabela) this.renderizarTabelaVeiculos(this.state.veiculos);
      this.atualizarSelectVeiculos();
    } catch (error) {
      Toast.error('Erro ao listar veículos: ' + error.message);
    }
  },

  renderizarTabelaVeiculos(lista) {
    const tbody = document.getElementById('tbody-veiculos');
    if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Nenhum veículo cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = lista.map(v => `
      <tr class="hover:bg-slate-700/30 transition">
        <td class="py-3 px-4 font-mono text-slate-400">#${v.id}</td>
        <td class="py-3 px-4 font-mono font-bold text-emerald-400 tracking-wider">${v.placa}</td>
        <td class="py-3 px-4">
          <div class="font-semibold text-slate-100">${v.marca} ${v.modelo}</div>
        </td>
        <td class="py-3 px-4 text-slate-300">${v.ano} • ${v.cor}</td>
        <td class="py-3 px-4 text-slate-300">${Formatters.km(v.quilometragem)}</td>
        <td class="py-3 px-4">
          <div class="text-slate-200">${v.proprietario_nome || '-'}</div>
          <div class="text-[11px] text-slate-400">${v.proprietario_telefone || ''}</div>
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="App.editarVeiculo(${v.id})" class="p-1.5 rounded hover:bg-slate-700 text-blue-400 hover:text-blue-300" title="Editar">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="App.solicitarExclusao('veiculo', ${v.id}, '${v.placa} - ${v.modelo.replace(/'/g, "\\'")}')" class="p-1.5 rounded hover:bg-slate-700 text-rose-400 hover:text-rose-300" title="Excluir">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  filtrarVeiculos() {
    const termo = document.getElementById('filtro-veiculo').value.toLowerCase();
    const filtrados = this.state.veiculos.filter(v => 
      v.placa.toLowerCase().includes(termo) || 
      v.modelo.toLowerCase().includes(termo) || 
      v.marca.toLowerCase().includes(termo) ||
      (v.proprietario_nome && v.proprietario_nome.toLowerCase().includes(termo))
    );
    this.renderizarTabelaVeiculos(filtrados);
  },

  abrirModalVeiculo(veiculo = null) {
    this.atualizarSelectClientes();
    document.getElementById('modal-veiculo').classList.remove('hidden');
    const form = document.getElementById('form-veiculo');
    form.reset();

    if (veiculo) {
      document.getElementById('modal-veiculo-titulo').innerHTML = '<i class="fa-solid fa-pen text-emerald-400"></i><span>Editar Veículo</span>';
      document.getElementById('veiculo-id').value = veiculo.id;
      document.getElementById('veiculo-cliente-id').value = veiculo.cliente_id;
      document.getElementById('veiculo-placa').value = veiculo.placa;
      document.getElementById('veiculo-marca').value = veiculo.marca;
      document.getElementById('veiculo-modelo').value = veiculo.modelo;
      document.getElementById('veiculo-ano').value = veiculo.ano;
      document.getElementById('veiculo-cor').value = veiculo.cor;
      document.getElementById('veiculo-km').value = veiculo.quilometragem;
    } else {
      document.getElementById('modal-veiculo-titulo').innerHTML = '<i class="fa-solid fa-car text-emerald-400"></i><span>Cadastrar Veículo</span>';
      document.getElementById('veiculo-id').value = '';
    }
  },

  fecharModalVeiculo() {
    document.getElementById('modal-veiculo').classList.add('hidden');
  },

  async editarVeiculo(id) {
    try {
      const res = await API.veiculos.buscarPorId(id);
      this.abrirModalVeiculo(res.data);
    } catch (err) {
      Toast.error('Erro ao buscar dados do veículo: ' + err.message);
    }
  },

  async salvarVeiculo(e) {
    e.preventDefault();
    const id = document.getElementById('veiculo-id').value;
    const dados = {
      cliente_id: Number(document.getElementById('veiculo-cliente-id').value),
      placa: document.getElementById('veiculo-placa').value,
      marca: document.getElementById('veiculo-marca').value,
      modelo: document.getElementById('veiculo-modelo').value,
      ano: Number(document.getElementById('veiculo-ano').value),
      cor: document.getElementById('veiculo-cor').value,
      quilometragem: Number(document.getElementById('veiculo-km').value || 0)
    };

    try {
      if (id) {
        await API.veiculos.atualizar(id, dados);
        Toast.success('Veículo atualizado com sucesso no MySQL!');
      } else {
        await API.veiculos.criar(dados);
        Toast.success('Veículo cadastrado com sucesso no MySQL!');
      }

      this.fecharModalVeiculo();
      await this.carregarVeiculos();
      await this.carregarDashboard();
    } catch (error) {
      Toast.error(error.message);
    }
  },

  atualizarSelectVeiculos() {
    const select = document.getElementById('manutencao-veiculo-id');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione o veículo...</option>' +
      this.state.veiculos.map(v => `
        <option value="${v.id}">${v.placa} — ${v.marca} ${v.modelo} (${v.proprietario_nome || 'Sem proprietário'})</option>
      `).join('');
  },


  async carregarManutencoes() {
    try {
      const res = await API.manutencoes.listar();
      this.state.manutencoes = res.data || [];
      this.renderizarTabelaManutencoes(this.state.manutencoes);
    } catch (error) {
      Toast.error('Erro ao listar manutenções: ' + error.message);
    }
  },

  renderizarTabelaManutencoes(lista) {
    const tbody = document.getElementById('tbody-manutencoes');
    if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="py-6 text-center text-slate-500">Nenhuma manutenção registrada.</td></tr>';
      return;
    }

    tbody.innerHTML = lista.map(m => `
      <tr class="hover:bg-slate-700/30 transition">
        <td class="py-3 px-4 font-mono font-bold text-indigo-400">#${m.id}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${m.tipo === 'PREVENTIVA' ? 'badge-preventiva' : 'badge-corretiva'}">
            ${m.tipo}
          </span>
        </td>
        <td class="py-3 px-4">
          <div class="font-semibold text-slate-100">${m.marca} ${m.modelo}</div>
          <div class="font-mono text-[11px] text-slate-400">${m.placa}</div>
        </td>
        <td class="py-3 px-4 text-slate-300">${m.proprietario_nome || '-'}</td>
        <td class="py-3 px-4 text-slate-200 max-w-xs truncate" title="${m.descricao}">${m.descricao}</td>
        <td class="py-3 px-4 text-slate-300">${Formatters.data(m.data_manutencao)}</td>
        <td class="py-3 px-4 text-slate-400">${Formatters.km(m.quilometragem_registro)}</td>
        <td class="py-3 px-4 text-right font-bold text-emerald-400">${Formatters.moeda(m.valor)}</td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold badge-${m.status.toLowerCase()}">
            ${m.status.replace('_', ' ')}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="App.editarManutencao(${m.id})" class="p-1.5 rounded hover:bg-slate-700 text-blue-400 hover:text-blue-300" title="Editar">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="App.solicitarExclusao('manutencao', ${m.id}, 'OS #${m.id} (${m.placa})')" class="p-1.5 rounded hover:bg-slate-700 text-rose-400 hover:text-rose-300" title="Excluir">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  filtrarManutencoes() {
    const termo = document.getElementById('filtro-manutencao').value.toLowerCase();
    const filtradas = this.state.manutencoes.filter(m => 
      m.placa.toLowerCase().includes(termo) ||
      m.descricao.toLowerCase().includes(termo) ||
      m.status.toLowerCase().includes(termo) ||
      m.tipo.toLowerCase().includes(termo) ||
      (m.proprietario_nome && m.proprietario_nome.toLowerCase().includes(termo))
    );
    this.renderizarTabelaManutencoes(filtradas);
  },

  abrirModalManutencao(m = null) {
    this.atualizarSelectVeiculos();
    document.getElementById('modal-manutencao').classList.remove('hidden');
    const form = document.getElementById('form-manutencao');
    form.reset();

    // Data padrão para hoje se novo
    const hoje = new Date().toISOString().split('T')[0];

    if (m) {
      document.getElementById('modal-manutencao-titulo').innerHTML = '<i class="fa-solid fa-pen text-indigo-400"></i><span>Editar Manutenção</span>';
      document.getElementById('manutencao-id').value = m.id;
      document.getElementById('manutencao-veiculo-id').value = m.veiculo_id;
      document.getElementById('manutencao-tipo').value = m.tipo;
      document.getElementById('manutencao-descricao').value = m.descricao;
      document.getElementById('manutencao-data').value = m.data_manutencao ? m.data_manutencao.split('T')[0] : hoje;
      document.getElementById('manutencao-km').value = m.quilometragem_registro;
      document.getElementById('manutencao-valor').value = m.valor;
      document.getElementById('manutencao-status').value = m.status;
      document.getElementById('manutencao-obs').value = m.observacoes || '';
    } else {
      document.getElementById('modal-manutencao-titulo').innerHTML = '<i class="fa-solid fa-wrench text-indigo-400"></i><span>Nova Ordem de Manutenção</span>';
      document.getElementById('manutencao-id').value = '';
      document.getElementById('manutencao-data').value = hoje;
      document.getElementById('manutencao-status').value = 'AGENDADA';
    }
  },

  fecharModalManutencao() {
    document.getElementById('modal-manutencao').classList.add('hidden');
  },

  async editarManutencao(id) {
    try {
      const res = await API.manutencoes.buscarPorId(id);
      this.abrirModalManutencao(res.data);
    } catch (err) {
      Toast.error('Erro ao buscar dados da manutenção: ' + err.message);
    }
  },

  async salvarManutencao(e) {
    e.preventDefault();
    const id = document.getElementById('manutencao-id').value;
    const dados = {
      veiculo_id: Number(document.getElementById('manutencao-veiculo-id').value),
      tipo: document.getElementById('manutencao-tipo').value,
      descricao: document.getElementById('manutencao-descricao').value,
      data_manutencao: document.getElementById('manutencao-data').value,
      quilometragem_registro: Number(document.getElementById('manutencao-km').value || 0),
      valor: parseFloat(document.getElementById('manutencao-valor').value),
      status: document.getElementById('manutencao-status').value,
      observacoes: document.getElementById('manutencao-obs').value
    };

    try {
      if (id) {
        await API.manutencoes.atualizar(id, dados);
        Toast.success('Manutenção atualizada com sucesso no MySQL!');
      } else {
        await API.manutencoes.criar(dados);
        Toast.success('Ordem de manutenção registrada com sucesso no MySQL!');
      }

      this.fecharModalManutencao();
      await this.carregarManutencoes();
      await this.carregarDashboard();
    } catch (error) {
      Toast.error(error.message);
    }
  },

 
  solicitarExclusao(tipo, id, nome) {
    this.state.itemParaExcluir = { tipo, id, nome };
    const modal = document.getElementById('modal-confirmar');
    const msg = document.getElementById('confirmar-mensagem');

    if (tipo === 'cliente') {
      msg.textContent = `Deseja realmente excluir o cliente "${nome}"? Atenção: Se houver veículos vinculados a ele, o MySQL bloqueará a operação (Foreign Key).`;
    } else if (tipo === 'veiculo') {
      msg.textContent = `Deseja realmente excluir o veículo "${nome}"? Atenção: Se houver manutenções registradas para ele, o MySQL bloqueará a exclusão.`;
    } else {
      msg.textContent = `Deseja realmente excluir o registro de ${nome}?`;
    }

    document.getElementById('btn-confirmar-exclusao').onclick = () => this.confirmarExclusao();
    modal.classList.remove('hidden');
  },

  fecharModalConfirmar() {
    document.getElementById('modal-confirmar').classList.add('hidden');
    this.state.itemParaExcluir = null;
  },

  async confirmarExclusao() {
    const item = this.state.itemParaExcluir;
    if (!item) return;

    try {
      if (item.tipo === 'cliente') {
        await API.clientes.excluir(item.id);
        Toast.success('Cliente excluído com sucesso do MySQL!');
        await this.carregarClientes();
      } else if (item.tipo === 'veiculo') {
        await API.veiculos.excluir(item.id);
        Toast.success('Veículo excluído com sucesso do MySQL!');
        await this.carregarVeiculos();
      } else if (item.tipo === 'manutencao') {
        await API.manutencoes.excluir(item.id);
        Toast.success('Registro de manutenção excluído com sucesso!');
        await this.carregarManutencoes();
      }

      this.fecharModalConfirmar();
      await this.carregarDashboard();
    } catch (error) {
      this.fecharModalConfirmar();
   
      Toast.error(error.message);
    }
  },


  sqlQueriesText: {
    join: `-- CONSULTA OBRIGATÓRIA 1: JUNÇÃO RELACIONAL (INNER JOIN)
-- Combina 3 tabelas relacionadas com navegação por chave estrangeira
SELECT 
    m.id AS manutencao_id,
    m.tipo,
    m.descricao,
    DATE_FORMAT(m.data_manutencao, '%d/%m/%Y') AS data_formatada,
    m.valor,
    m.status,
    v.placa,
    v.marca,
    v.modelo,
    c.nome AS proprietario,
    c.telefone
FROM manutencoes m
INNER JOIN veiculos v ON m.veiculo_id = v.id
INNER JOIN clientes c ON v.cliente_id = c.id
ORDER BY m.data_manutencao DESC;`,

    agregacao: `-- CONSULTA OBRIGATÓRIA 2: AGREGAÇÃO COM GROUP BY (MYSQL 8 ONLY_FULL_GROUP_BY)
-- Agrupa por veículo e calcula COUNT de manutenções, soma e ticket médio
SELECT 
    v.id AS veiculo_id,
    v.placa,
    v.marca,
    v.modelo,
    v.ano,
    c.nome AS proprietario,
    COUNT(m.id) AS total_manutencoes,
    COALESCE(SUM(m.valor), 0.00) AS total_gasto,
    COALESCE(AVG(m.valor), 0.00) AS ticket_medio
FROM veiculos v
INNER JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN manutencoes m ON m.veiculo_id = v.id
GROUP BY 
    v.id,
    v.placa,
    v.marca,
    v.modelo,
    v.ano,
    c.nome
ORDER BY total_gasto DESC;`,

    subquery: `-- CONSULTA OBRIGATÓRIA 3: SUBCONSULTA (SUBQUERY COM HAVING)
-- Identifica veículos cujo gasto total excede a média global dinâmica
SELECT 
    v.id AS veiculo_id,
    v.placa,
    CONCAT(v.marca, ' ', v.modelo) AS veiculo,
    c.nome AS proprietario,
    COUNT(m.id) AS qtd_servicos,
    SUM(m.valor) AS gasto_acumulado
FROM veiculos v
INNER JOIN clientes c ON v.cliente_id = c.id
INNER JOIN manutencoes m ON m.veiculo_id = v.id
GROUP BY 
    v.id,
    v.placa,
    v.marca,
    v.modelo,
    c.nome
HAVING gasto_acumulado > (
    SELECT AVG(sub.gasto_veiculo)
    FROM (
        SELECT SUM(m2.valor) AS gasto_veiculo
        FROM manutencoes m2
        GROUP BY m2.veiculo_id
    ) AS sub
)
ORDER BY gasto_acumulado DESC;`
  },

  async executarLaboratorioSQL(tipo) {
    this.state.labQueryAtual = tipo;
    const pre = document.getElementById('lab-sql-code');
    const title = document.getElementById('lab-sql-title');
    const count = document.getElementById('lab-result-count');
    const thead = document.getElementById('lab-table-head');
    const tbody = document.getElementById('lab-table-body');

    // Atualiza botões
    ['join', 'agregacao', 'subquery'].forEach(t => {
      const btn = document.getElementById(`btn-lab-${t}`);
      if (t === tipo) {
        btn?.classList.remove('border-slate-700');
        btn?.classList.add('border-blue-500', 'bg-slate-800/90');
      } else {
        btn?.classList.remove('border-blue-500', 'bg-slate-800/90');
        btn?.classList.add('border-slate-700');
      }
    });

    pre.textContent = this.sqlQueriesText[tipo] || '';

    if (tipo === 'join') {
      title.textContent = 'Query 1: Junção Relacional (INNER JOIN entre manutencoes, veiculos e clientes)';
    } else if (tipo === 'agregacao') {
      title.textContent = 'Query 2: Agregação com GROUP BY, COUNT, SUM e AVG (MySQL 8)';
    } else if (tipo === 'subquery') {
      title.textContent = 'Query 3: Subconsulta (Subquery com HAVING para comparar com a média geral)';
    }

    tbody.innerHTML = '<tr><td class="p-4 text-center text-slate-400">Executando consulta no MySQL 8...</td></tr>';
    thead.innerHTML = '<tr><th class="p-3">Processando...</th></tr>';

    try {
      let res;
      if (tipo === 'join') res = await API.relatorios.join();
      else if (tipo === 'agregacao') res = await API.relatorios.agregacao();
      else if (tipo === 'subquery') res = await API.relatorios.subquery();

      const dados = res.data || [];
      count.textContent = `${dados.length} registros retornados do MySQL`;

      if (dados.length === 0) {
        thead.innerHTML = '<tr><th class="p-3">Sem colunas</th></tr>';
        tbody.innerHTML = '<tr><td class="p-4 text-center text-slate-500">Nenhum resultado retornado para esta consulta.</td></tr>';
        return;
      }

      const colunas = Object.keys(dados[0]);
      thead.innerHTML = `<tr>${colunas.map(c => `<th class="py-2.5 px-3 uppercase text-[11px]">${c}</th>`).join('')}</tr>`;

      tbody.innerHTML = dados.map(linha => `
        <tr class="hover:bg-slate-800/70 transition">
          ${colunas.map(c => {
            let val = linha[c];
            if (c.toLowerCase().includes('valor') || c.toLowerCase().includes('gasto') || c.toLowerCase().includes('medio')) {
              val = Formatters.moeda(val);
            }
            return `<td class="py-2 px-3 text-xs text-slate-300 font-mono">${val !== null && val !== undefined ? val : '-'}</td>`;
          }).join('')}
        </tr>
      `).join('');

      Toast.success(`Query '${tipo}' executada com sucesso no MySQL!`);
    } catch (err) {
      count.textContent = 'Erro';
      tbody.innerHTML = `<tr><td class="p-4 text-center text-rose-400">Falha na execução: ${err.message}</td></tr>`;
      Toast.error('Erro ao executar query: ' + err.message);
    }
  },

  reexecutarLaboratorioSQL() {
    this.executarLaboratorioSQL(this.state.labQueryAtual || 'join');
  },


  configurarMascaras() {
    const cpfInput = document.getElementById('cliente-cpf');
    if (cpfInput) {
      cpfInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        e.target.value = v;
      });
    }

    const telInput = document.getElementById('cliente-telefone');
    if (telInput) {
      telInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.substring(0, 11);
        if (v.length > 10) {
          v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (v.length > 5) {
          v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        } else if (v.length > 2) {
          v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
        }
        e.target.value = v;
      });
    }

    const placaInput = document.getElementById('veiculo-placa');
    if (placaInput) {
      placaInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
