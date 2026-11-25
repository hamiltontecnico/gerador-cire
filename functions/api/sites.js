  function preencherCamposComSite(d) {
    document.getElementById('site').value = d.site || ''; espelharSite();
    document.getElementById('rota').value = d.rota || '';
    document.getElementById('ponta_a').value = d.ponta_a || '';
    document.getElementById('endereco_ponta_a').value = d.endereco_ponta_a || '';
    document.getElementById('ponta_b').value = d.ponta_b || '';
    document.getElementById('endereco_ponta_b').value = d.endereco_ponta_b || '';
    document.getElementById('afetacao').value = d.afetacao || '';

    // Alça 1
    document.getElementById('cabo1').value = d.cabo1 || '';
    document.getElementById('fibra1').value = d.fibra1 || '';
    document.getElementById('dist_ab1').value = d.dist_ab1 || '';
    document.getElementById('dist_ba1').value = d.dist_ba1 || '';
    document.getElementById('dist_tot1').value = d.dist_total1 || '';
    document.getElementById('equip1').value = d.equip1 || '';

    // Alça 2
    document.getElementById('cabo2').value = d.cabo2 || '';
    document.getElementById('fibra2').value = d.fibra2 || '';
    document.getElementById('dist_ab2').value = d.dist_ab2 || '';
    document.getElementById('dist_ba2').value = d.dist_ba2 || '';
    document.getElementById('dist_tot2').value = d.dist_total2 || '';
    document.getElementById('equip2').value = d.equip2 || '';

    // Carimbo de Acesso
    document.getElementById('detentora').value = d.detentora || '';
    document.getElementById('id_acesso').value = d.id_acesso || '';
    document.getElementById('portao').value = d.portao || '';
    document.getElementById('gabinete').value = d.gabinete || '';
    document.getElementById('medidor').value = d.medidor || '';
    document.getElementById('uc').value = d.uc || '';
    document.getElementById('link_maps').value = d.link_maps || '';
    document.getElementById('obs').value = d.obs || '';
    document.getElementById('rodape').value = d.rodape || '';
    atualizarPreview();
  }

  async function gerarESalvar() {
    var v = function(id) { return document.getElementById(id).value.trim(); };
    var site = v('site').toUpperCase();
    if (!site) { alert('Informe o código do Site.'); return; }
    var textoCarimbo = montarTextoCarimbo();
    document.getElementById('carimboPreview').textContent = textoCarimbo;
    try { await navigator.clipboard.writeText(textoCarimbo); } catch (e) {}

    var payload = {
      site: site, rota: v('rota'),
      ponta_a: v('ponta_a'), endereco_ponta_a: v('endereco_ponta_a'),
      ponta_b: v('ponta_b'), endereco_ponta_b: v('endereco_ponta_b'),
      afetacao: v('afetacao'),
      cabo1: v('cabo1'), fibra1: v('fibra1'),
      dist_ab1: v('dist_ab1'), dist_ba1: v('dist_ba1'), dist_total1: v('dist_tot1'), equip1: v('equip1'),
      cabo2: v('cabo2'), fibra2: v('fibra2'),
      dist_ab2: v('dist_ab2'), dist_ba2: v('dist_ba2'), dist_total2: v('dist_tot2'), equip2: v('equip2'),
      detentora: v('detentora'), id_acesso: v('id_acesso'), portao: v('portao'), gabinete: v('gabinete'),
      medidor: v('medidor'), uc: v('uc'), link_maps: v('link_maps'), obs: v('obs'), rodape: v('rodape'),
      atualizado_por: usuarioLogado ? usuarioLogado.nome_completo : 'Técnico',
      forcarAtualizacao: false
    };

    try {
      var res = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.status === 409) {
        if (confirm('O site ' + site + ' já existe!\n\nDeseja ATUALIZAR o cadastro com as melhorias?')) {
          payload.forcarAtualizacao = true;
          res = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (res.ok) mostrarBanner('🔄 Site ' + site + ' atualizado e carimbo copiado!', 'status-found');
        } else { mostrarBanner('📋 Carimbo copiado!', 'status-info'); }
      } else if (res.ok) { mostrarBanner('✅ Novo site ' + site + ' salvo e carimbo copiado!', 'status-found'); }
    } catch (e) { mostrarBanner('📋 Carimbo copiado!', 'status-warn'); }
  }

  // Função Exclusiva de Administrador para Importar JSONs do Google Keep direto pela tela
  async function importarArquivosKeepAdmin(event) {
    var files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    var senhaAdmin = prompt('Digite a SENHA DE ADMINISTRADOR para importar ' + files.length + ' arquivo(s):');
    if (!senhaAdmin) return;

    var pegarCampo = function(texto, chave) {
      var regex = new RegExp('\\*' + chave + '\\s*:\\*\\s*(.*)', 'i');
      var m = String(texto || '').match(regex);
      return m && m ? m.trim() : '';
    };
    var limparDist = function(v) {
      var s = String(v || '').replace(/\s*mts/i, '').trim();
      return /^x+$/i.test(s) ? '' : s;
    };

    var sitesExtraidos = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var nota = JSON.parse(await files[i].text());
        if (nota.isTrashed) continue;
        var texto = String(nota.textContent || '');
        if (!texto.includes('CARIMBO')) continue;
        var site = (nota.title || pegarCampo(texto, 'Site')).trim().toUpperCase();
        if (!site || site.startsWith('***ABRIR')) continue;

        var enderecos = [...texto.matchAll(/\*Endere[çc]o:\*\s*(.*)/gi)].map(function(m) { return m.trim(); });
        var idx1 = texto.search(/\*Al[çc]a 1\*/i);
        var idx2 = texto.search(/\*Al[çc]a 2\*/i);
        var idxFim = texto.search(/\*OBS:\*|\*Localiza[çc][ãa]o\*|CARIMBO DE ACESSO/i);
        var b1 = idx1 !== -1 ? texto.slice(idx1, idx2 !== -1 ? idx2 : (idxFim !== -1 ? idxFim : texto.length)) : '';
        var b2 = idx2 !== -1 ? texto.slice(idx2, idxFim !== -1 && idxFim > idx2 ? idxFim : texto.length) : '';
        var idxAcesso = texto.search(/CARIMBO DE ACESSO/i);
        var bAcesso = idxAcesso !== -1 ? texto.slice(idxAcesso) : '';

        var matchLink = texto.match(/(https?:\/\/maps\.app\.goo\.gl\/[^\s]+|https?:\/\/www\.google\.com\/maps[^\s]+)/);
        var equip1 = b1.split('\n').filter(function(l) { var t = l.trim(); return t && !t.startsWith('*') && !t.startsWith('http'); }).join('\n');
        var equip2 = b2.split('\n').filter(function(l) { var t = l.trim(); return t && !t.startsWith('*') && !t.startsWith('http'); }).join('\n');

        sitesExtraidos.push({
          site: site,
          rota: pegarCampo(texto, 'Rota'),
          ponta_a: pegarCampo(texto, 'Ponta A') || site,
          endereco_ponta_a: enderecos || '',
          ponta_b: pegarCampo(texto, 'Ponta B'),
          endereco_ponta_b: enderecos || '',
          afetacao: pegarCampo(texto, 'Afeta[çc][ãa]o'),
          cabo1: pegarCampo(b1, 'Cabo'), fibra1: pegarCampo(b1, 'Fibra'),
          dist_ab1: limparDist(pegarCampo(b1, 'Dist[âa]ncia de A_\\s*B')),
          dist_ba1: limparDist(pegarCampo(b1, 'Dist[âa]ncia de B_\\s*A')),
          dist_total1: limparDist(pegarCampo(b1, 'Dist[âa]ncia\\s+total')),
          equip1: equip1,
          cabo2: pegarCampo(b2, 'Cabo'), fibra2: pegarCampo(b2, 'Fibra'),
          dist_ab2: limparDist(pegarCampo(b2, 'Dist[âa]ncia de A_\\s*B')),
          dist_ba2: limparDist(pegarCampo(b2, 'Dist[âa]ncia de B_\\s*A')),
          dist_total2: limparDist(pegarCampo(b2, 'Dist[âa]ncia\\s+total')),
          equip2: equip2,
          detentora: pegarCampo(bAcesso, 'Detentora'),
          id_acesso: pegarCampo(bAcesso, 'ID'),
          portao: pegarCampo(bAcesso, 'Port[ãa]o'),
          gabinete: pegarCampo(bAcesso, 'Gabinete'),
          medidor: pegarCampo(bAcesso, 'Medidor'),
          uc: pegarCampo(bAcesso, 'UC'),
          link_maps: matchLink ? matchLink : '',
          obs: pegarCampo(texto, 'OBS'),
          rodape: ''
        });
      } catch (e) {}
    }

    if (!sitesExtraidos.length) { alert('Nenhum carimbo válido encontrado nos arquivos selecionados.'); return; }

    mostrarBanner('⏳ Importando ' + sitesExtraidos.length + ' site(s)...', 'status-info');
    var res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: 'importar_lote',
        senhaAdmin: senhaAdmin,
        sites: sitesExtraidos,
        atualizado_por: usuarioLogado.nome_completo + ' (Importação)'
      })
    });
    var json = await res.json();
    if (res.ok && json.sucesso) {
      mostrarBanner('✅ ' + json.total + ' site(s) importados/atualizados com sucesso!', 'status-found');
    } else {
      alert(json.erro || 'Erro ao importar.');
    }
  }
      dados.dist_total2 || '',
      dados.equip2 || '',
      dados.detentora || '',
      dados.id_acesso || '',
      dados.portao || '',
      dados.gabinete || '',
      dados.medidor || '',
      dados.uc || '',
      dados.link_maps || '',
      dados.obs || '',
      dados.rodape || '',
      dados.atualizado_por || 'Sistema'
    ).run();

    return Response.json({ sucesso: true, acao: existe ? 'atualizado' : 'criado' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  try {
    const { searchParams } = new URL(context.request.url);
    const site = searchParams.get('site')?.trim().toUpperCase();
    const senha = searchParams.get('senha')?.trim();
    const usuarioId = searchParams.get('usuarioId');

    if (usuarioId) {
      if (senha !== SENHA_EXCLUSAO_ADMIN) {
        return Response.json({ erro: "Senha de administrador incorreta." }, { status: 403 });
      }
      await context.env.DB.prepare("DELETE FROM usuarios WHERE id = ? AND is_admin = 0").bind(usuarioId).run();
      return Response.json({ sucesso: true });
    }

    if (!site) {
      return Response.json({ erro: "Informe o site para excluir." }, { status: 400 });
    }
    if (senha !== SENHA_EXCLUSAO_ADMIN) {
      return Response.json({ erro: "Senha de confirmação incorreta! Exclusão bloqueada." }, { status: 403 });
    }

    await context.env.DB.prepare(
      "DELETE FROM sites_cire WHERE site = ? COLLATE NOCASE"
    ).bind(site).run();

    return Response.json({ sucesso: true, mensagem: "Site removido com sucesso." });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
