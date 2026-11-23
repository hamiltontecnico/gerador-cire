// Senha master para confirmar exclusão de sites e gerenciar técnicos
const SENHA_EXCLUSAO_ADMIN = "cire2026";

export async function onRequestGet(context) {
  try {
    const { searchParams } = new URL(context.request.url);
    const acao = searchParams.get('acao');
    const site = searchParams.get('site')?.trim().toUpperCase();

    // 1. Listar todos os sites cadastrados
    if (acao === 'listar') {
      const { results } = await context.env.DB.prepare(
        "SELECT * FROM sites_cire ORDER BY site ASC"
      ).all();
      return Response.json({ sites: results || [] });
    }

    // 2. Listar técnicos (apenas para admin)
    if (acao === 'usuarios') {
      const { results } = await context.env.DB.prepare(
        "SELECT id, usuario, nome_completo, contato, is_admin FROM usuarios ORDER BY nome_completo ASC"
      ).all();
      return Response.json({ usuarios: results || [] });
    }

    // 3. Pesquisar um site específico (busca exata primeiro, depois parcial: ex. 0AE acha "0AE ( ZERO AE)")
    if (!site) {
      return Response.json({ error: "Informe o nome do site" }, { status: 400 });
    }

    let registro = await context.env.DB.prepare(
      "SELECT * FROM sites_cire WHERE site = ? COLLATE NOCASE"
    ).bind(site).first();

    if (!registro) {
      registro = await context.env.DB.prepare(
        "SELECT * FROM sites_cire WHERE site LIKE ? COLLATE NOCASE ORDER BY LENGTH(site) ASC LIMIT 1"
      ).bind(site + '%').first();
    }

    if (!registro) {
      registro = await context.env.DB.prepare(
        "SELECT * FROM sites_cire WHERE site LIKE ? COLLATE NOCASE ORDER BY LENGTH(site) ASC LIMIT 1"
      ).bind('%' + site + '%').first();
    }

    return Response.json({ encontrado: !!registro, dados: registro || null });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const dados = await context.request.json();

    // 1. ROTA DE LOGIN
    if (dados.acao === 'login') {
      const user = await context.env.DB.prepare(
        "SELECT id, usuario, nome_completo, contato, is_admin FROM usuarios WHERE usuario = ? COLLATE NOCASE AND senha = ?"
      ).bind(dados.usuario?.trim(), dados.senha?.trim()).first();

      if (!user) {
        return Response.json({ erro: "Usuário ou senha inválidos." }, { status: 401 });
      }
      return Response.json({ sucesso: true, usuario: user });
    }

    // 2. ROTA PARA ADMIN CRIAR NOVO TÉCNICO
    if (dados.acao === 'criar_usuario') {
      if (dados.senhaAdmin !== SENHA_EXCLUSAO_ADMIN) {
        return Response.json({ erro: "Senha de administrador incorreta." }, { status: 403 });
      }
      await context.env.DB.prepare(
        "INSERT INTO usuarios (usuario, senha, nome_completo, contato, is_admin) VALUES (?, ?, ?, ?, 0)"
      ).bind(
        dados.novoUsuario.trim().toLowerCase(),
        dados.novaSenha.trim(),
        dados.nomeCompleto.trim(),
        dados.contato?.trim() || ''
      ).run();
      return Response.json({ sucesso: true });
    }
        // 2B. ROTA PARA ADMIN EDITAR TÉCNICO EXISTENTE
    if (dados.acao === 'editar_usuario') {
      if (dados.senhaAdmin !== SENHA_EXCLUSAO_ADMIN) {
        return Response.json({ erro: "Senha de administrador incorreta." }, { status: 403 });
      }
      if (dados.novaSenha && dados.novaSenha.trim() !== '') {
        await context.env.DB.prepare(
          "UPDATE usuarios SET usuario = ?, senha = ?, nome_completo = ?, contato = ? WHERE id = ?"
        ).bind(
          dados.novoUsuario.trim().toLowerCase(),
          dados.novaSenha.trim(),
          dados.nomeCompleto.trim(),
          dados.contato?.trim() || '',
          dados.usuarioId
        ).run();
      } else {
        await context.env.DB.prepare(
          "UPDATE usuarios SET usuario = ?, nome_completo = ?, contato = ? WHERE id = ?"
        ).bind(
          dados.novoUsuario.trim().toLowerCase(),
          dados.nomeCompleto.trim(),
          dados.contato?.trim() || '',
          dados.usuarioId
        ).run();
      }
      return Response.json({ sucesso: true });
    }


    // 3. ROTA PARA SALVAR OU MELHORAR SITE
    let siteNome = dados.site?.trim().toUpperCase();
    if (!siteNome) {
      return Response.json({ error: "O campo Site é obrigatório." }, { status: 400 });
    }

    // Verifica se já existe exato ou com complemento (ex: 0AE vs "0AE ( ZERO AE)")
    let existe = await context.env.DB.prepare(
      "SELECT * FROM sites_cire WHERE site = ? COLLATE NOCASE"
    ).bind(siteNome).first();

    if (!existe) {
      existe = await context.env.DB.prepare(
        "SELECT * FROM sites_cire WHERE site LIKE ? COLLATE NOCASE ORDER BY LENGTH(site) ASC LIMIT 1"
      ).bind(siteNome + ' (%').first();
    }

    if (existe && !dados.forcarAtualizacao) {
      return Response.json(
        { erro: "DUPLICADO", mensagem: "Este site já existe no banco de dados como: " + existe.site },
        { status: 409 }
      );
    }

    // Se já existia com complemento e o usuário digitou só a sigla curta, mantém o nome completo salvo no banco
    if (existe && existe.site.length > siteNome.length && !siteNome.includes('(')) {
      siteNome = existe.site;
    }

    await context.env.DB.prepare(`
      INSERT INTO sites_cire (
        site, rota, ponta_a, endereco_ponta_a, detentora, id_acesso,
        portao, gabinete, medidor, uc, link_maps, obs, rodape, equip1, atualizado_por
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site) DO UPDATE SET
        rota = COALESCE(NULLIF(excluded.rota, ''), sites_cire.rota),
        ponta_a = COALESCE(NULLIF(excluded.ponta_a, ''), sites_cire.ponta_a),
        endereco_ponta_a = COALESCE(NULLIF(excluded.endereco_ponta_a, ''), sites_cire.endereco_ponta_a),
        detentora = COALESCE(NULLIF(excluded.detentora, ''), sites_cire.detentora),
        id_acesso = COALESCE(NULLIF(excluded.id_acesso, ''), sites_cire.id_acesso),
        portao = COALESCE(NULLIF(excluded.portao, ''), sites_cire.portao),
        gabinete = COALESCE(NULLIF(excluded.gabinete, ''), sites_cire.gabinete),
        medidor = COALESCE(NULLIF(excluded.medidor, ''), sites_cire.medidor),
        uc = COALESCE(NULLIF(excluded.uc, ''), sites_cire.uc),
        link_maps = COALESCE(NULLIF(excluded.link_maps, ''), sites_cire.link_maps),
        obs = COALESCE(NULLIF(excluded.obs, ''), sites_cire.obs),
        rodape = COALESCE(NULLIF(excluded.rodape, ''), sites_cire.rodape),
        equip1 = COALESCE(NULLIF(excluded.equip1, ''), sites_cire.equip1),
        atualizado_por = excluded.atualizado_por,
        atualizado_em = CURRENT_TIMESTAMP
    `).bind(
      siteNome,
      dados.rota || '',
      dados.ponta_a || '',
      dados.endereco_ponta_a || '',
      dados.detentora || '',
      dados.id_acesso || '',
      dados.portao || '',
      dados.gabinete || '',
      dados.medidor || '',
      dados.uc || '',
      dados.link_maps || '',
      dados.obs || '',
      dados.rodape || '',
      dados.equip1 || '',
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

    // Excluir técnico (Admin)
    if (usuarioId) {
      if (senha !== SENHA_EXCLUSAO_ADMIN) {
        return Response.json({ erro: "Senha de administrador incorreta." }, { status: 403 });
      }
      await context.env.DB.prepare("DELETE FROM usuarios WHERE id = ? AND is_admin = 0").bind(usuarioId).run();
      return Response.json({ sucesso: true });
    }

    // Excluir Site (exige senha master)
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
