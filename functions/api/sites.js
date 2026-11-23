export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const site = searchParams.get('site')?.trim().toUpperCase();

  if (!site) {
    return Response.json({ error: "Informe o nome do site" }, { status: 400 });
  }

  const registro = await context.env.DB.prepare(
    "SELECT * FROM sites_cire WHERE site = ? COLLATE NOCASE"
  ).bind(site).first();

  return Response.json({ encontrado: !!registro, dados: registro || null });
}

export async function onRequestPost(context) {
  try {
    const dados = await context.request.json();
    const siteNome = dados.site?.trim().toUpperCase();

    if (!siteNome) {
      return Response.json({ error: "O campo Site é obrigatório." }, { status: 400 });
    }

    const existe = await context.env.DB.prepare(
      "SELECT * FROM sites_cire WHERE site = ? COLLATE NOCASE"
    ).bind(siteNome).first();

    // Trava para não criar repetido sem confirmação
    if (existe && !dados.forcarAtualizacao) {
      return Response.json(
        { erro: "DUPLICADO", mensagem: "Este site já existe no banco de dados!" },
        { status: 409 }
      );
    }

    // Salva novo ou atualiza o existente (sempre melhorando os dados)
    await context.env.DB.prepare(`
      INSERT INTO sites_cire (
        site, rota, ponta_a, endereco_ponta_a, detentora, id_acesso,
        portao, gabinete, medidor, uc, link_maps, obs
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      dados.obs || ''
    ).run();

    return Response.json({ sucesso: true, acao: existe ? 'atualizado' : 'criado' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
