const SENHA_EXCLUSAO_ADMIN = "cire2026";

export async function onRequestGet(context) {
  try {
    const { searchParams } = new URL(context.request.url);
    const acao = searchParams.get('acao');
    const site = searchParams.get('site')?.trim().toUpperCase();

    if (acao === 'listar') {
      const { results } = await context.env.DB.prepare(
        "SELECT * FROM sites_cire ORDER BY site ASC"
      ).all();
      return Response.json({ sites: results || [] });
    }

    if (acao === 'usuarios') {
      const { results } = await context.env.DB.prepare(
        "SELECT id, usuario, nome_completo, contato, is_admin FROM usuarios ORDER BY nome_completo ASC"
      ).all();
      return Response.json({ usuarios: results || [] });
    }

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

    if (dados.acao === 'login') {
      const user = await context.env.DB.prepare(
        "SELECT id, usuario, nome_completo, contato, is_admin FROM usuarios WHERE usuario = ? COLLATE NOCASE AND senha = ?"
      ).bind(dados.usuario?.trim(), dados.senha?.trim()).first();

      if (!user) {
        return Response.json({ erro: "Usuário ou senha inválidos." }, { status: 401 });
      }
      return Response.json({ sucesso: true, usuario: user });
    }

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

    const SQL_UPSERT_SITE = `
      INSERT INTO sites_cire (
        site, rota, ponta_a, endereco_ponta_a, ponta_b, endereco_ponta_b, afetacao,
        cabo1, fibra1, dist_ab1, dist_ba1, dist_total1, equip1,
        cabo2, fibra2, dist_ab2, dist_ba2, dist_total2, equip2,
        detentora, id_acesso, portao, gabinete, medidor, uc, link_maps, obs, rodape, atualizado_por
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site) DO UPDATE SET
        rota = COALESCE(NULLIF(excluded.rota, ''), sites_cire.rota),
        ponta_a = COALESCE(NULLIF(excluded.ponta_a, ''), sites_cire.ponta_a),
        endereco_ponta_a = COALESCE(NULLIF(excluded.endereco_ponta_a, ''), sites_cire.endereco_ponta_a),
        ponta_b = COALESCE(NULLIF(excluded.ponta_b, ''), sites_cire.ponta_b),
        endereco_ponta_b = COALESCE(NULLIF(excluded.endereco_ponta_b, ''), sites_cire.endereco_ponta_b),
        afetacao = COALESCE(NULLIF(excluded.afetacao, ''), sites_cire.afetacao),
        cabo1 = COALESCE(NULLIF(excluded.cabo1, ''), sites_cire.cabo1),
        fibra1 = COALESCE(NULLIF(excluded.fibra1, ''), sites_cire.fibra1),
        dist_ab1 = COALESCE(NULLIF(excluded.dist_ab1, ''), sites_cire.dist_ab1),
        dist_ba1 = COALESCE(NULLIF(excluded.dist_ba1, ''), sites_cire.dist_ba1),
        dist_total1 = COALESCE(NULLIF(excluded.dist_total1, ''), sites_cire.dist_total1),
        equip1 = COALESCE(NULLIF(excluded.equip1, ''), sites_cire.equip1),
        cabo2 = COALESCE(NULLIF(excluded.cabo2, ''), sites_cire.cabo2),
        fibra2 = COALESCE(NULLIF(excluded.fibra2, ''), sites_cire.fibra2),
        dist_ab2 = COALESCE(NULLIF(excluded.dist_ab2, ''), sites_cire.dist_ab2),
        dist_ba2 = COALESCE(NULLIF(excluded.dist_ba2, ''), sites_cire.dist_ba2),
        dist_total2 = COALESCE(NULLIF(excluded.dist_total2, ''), sites_cire.dist_total2),
        equip2 = COALESCE(NULLIF(excluded.equip2, ''), sites_cire.equip2),
        detentora = COALESCE(NULLIF(excluded.detentora, ''), sites_cire.detentora),
        id_acesso = COALESCE(NULLIF(excluded.id_acesso, ''), sites_cire.id_acesso),
        portao = COALESCE(NULLIF(excluded.portao, ''), sites_cire.portao),
        gabinete = COALESCE(NULLIF(excluded.gabinete, ''), sites_cire.gabinete),
        medidor = COALESCE(NULLIF(excluded.medidor, ''), sites_cire.medidor),
        uc = COALESCE(NULLIF(excluded.uc, ''), sites_cire.uc),
        link_maps = COALESCE(NULLIF(excluded.link_maps, ''), sites_cire.link_maps),
        obs = COALESCE(NULLIF(excluded.obs, ''), sites_cire.obs),
        rodape = COALESCE(NULLIF(excluded.rodape, ''), sites_cire.rodape),
        atualizado_por = excluded.atualizado_por,
        atualizado_em = CURRENT_TIMESTAMP
    `;

    if (dados.acao === 'importar_lote') {
      if (dados.senhaAdmin !== SENHA_EXCLUSAO_ADMIN) {
        return Response.json({ erro: "Senha de administrador incorreta." }, { status: 403 });
      }
      const lista = dados.sites || [];
      if (!Array.isArray(lista) || lista.length === 0) {
        return Response.json({ erro: "Nenhum site válido encontrado." }, { status: 400 });
      }

      const stmt = context.env.DB.prepare(SQL_UPSERT_SITE);
      const batch = lista.map((s) =>
        stmt.bind(
          (s.site || '').trim().toUpperCase(),
          s.rota || '',
          s.ponta_a || '',
          s.endereco_ponta_a || '',
          s.ponta_b || '',
          s.endereco_ponta_b || '',
          s.afetacao || '',
          s.cabo1 || '',
          s.fibra1 || '',
          s.dist_ab1 || '',
          s.dist_ba1 || '',
          s.dist_total1 || '',
          s.equip1 || '',
          s.cabo2 || '',
          s.fibra2 || '',
          s.dist_ab2 || '',
          s.dist_ba2 || '',
          s.dist_total2 || '',
          s.equip2 || '',
          s.detentora || '',
          s.id_acesso || '',
          s.portao || '',
          s.gabinete || '',
          s.medidor || '',
          s.uc || '',
          s.link_maps || '',
          s.obs || '',
          s.rodape || '',
          dados.atualizado_por || 'Admin (Importação)'
        )
      );

      await context.env.DB.batch(batch);
      return Response.json({ sucesso: true, total: batch.length });
    }

    let siteNome = dados.site?.trim().toUpperCase();
    if (!siteNome) {
      return Response.json({ error: "O campo Site é obrigatório." }, { status: 400 });
    }

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

    if (existe && existe.site.length > siteNome.length && !siteNome.includes('(')) {
      siteNome = existe.site;
    }

    await context.env.DB.prepare(SQL_UPSERT_SITE).bind(
      siteNome,
      dados.rota || '',
      dados.ponta_a || '',
      dados.endereco_ponta_a || '',
      dados.ponta_b || '',
      dados.endereco_ponta_b || '',
      dados.afetacao || '',
      dados.cabo1 || '',
      dados.fibra1 || '',
      dados.dist_ab1 || '',
      dados.dist_ba1 || '',
      dados.dist_total1 || '',
      dados.equip1 || '',
      dados.cabo2 || '',
      dados.fibra2 || '',
      dados.dist_ab2 || '',
      dados.dist_ba2 || '',
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
