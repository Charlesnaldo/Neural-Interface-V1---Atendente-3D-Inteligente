# Fotos voluntárias dos visitantes

O rastreamento ao vivo não grava fotos automaticamente. Com a câmera ligada e somente uma pessoa no enquadramento, o visitante pode preparar uma foto, conferir a prévia e autorizar seu armazenamento. O nome é opcional e informado pela própria pessoa. Não há busca de identidade na internet.

Durante o rastreamento, uma varredura azul e uma malha decorativa acompanham a caixa de cada rosto detectado. A malha não representa pontos faciais medidos nem uma análise de identidade. O efeito respeita a preferência por movimento reduzido. Após o banco confirmar o salvamento autorizado, a prévia é fechada e a câmera é desligada, removendo a imagem e a animação da tela. Se o envio falhar, a prévia permanece para nova tentativa.

As miniaturas JPEG de 256 × 256 ficam na tabela `zord_visitor_photos` do Supabase. A galeria `/admin/photos` exige a conta administrativa. RLS bloqueia leitura por visitantes e outras contas; as fotos não possuem URL pública. O administrador pode excluir registros individualmente.

O navegador guarda apenas um segredo aleatório para revogar cada envio. O botão de exclusão funciona mesmo com a câmera desligada. Limpar os dados do navegador remove essa possibilidade local; nesse caso, solicite a exclusão ao administrador. O banco conserva apenas o hash desse segredo.

O envio público é limitado a dez fotos por minuto no conjunto do sistema e mil registros armazenados. Cada navegador mantém até vinte comprovantes de exclusão. Os registros permanecem até sua exclusão; a exclusão remove o registro ativo, seguindo os prazos próprios de retenção de backups do provedor.

As funções privilegiadas de inserção e revogação ficam em schema privado, com execução explicitamente concedida. Não oferecem leitura pública. A lista administrativa do banco é configurada privadamente em `zord_private.admin_emails` e deve acompanhar `ADMIN_EMAILS` do servidor. Não usar metadados editáveis do usuário para conceder acesso.
