## Execução local — 09/10/2026

Neste computador, DATA_MODE=file utiliza um banco persistente em .run/local-database.json. O login de administradores e clientes, cadastro de novos administradores, serviços, bloqueios e reservas passam pelo servidor. Abra Iniciar.cmd; para parar ou reiniciar, utilize Parar.cmd ou Reiniciar.cmd. Acesso: http://127.0.0.1:4173/admin. Usuário e senha ficam no arquivo privado .run/ACESSO-ADMIN.txt.

Faça backup da pasta .run para preservar banco e acessos. O modo file é destinado a uma única instância local do servidor e não sincroniza com o Atlas. A configuração MongoDB foi preservada no .env; para voltar ao Atlas, altere DATA_MODE=mongodb após resolver a rede e substituir a credencial exposta anteriormente. A função da Vercel continua usando exclusivamente MongoDB.

## Atualização de 08/10/2026 — Vercel, administradores e múltiplos serviços

- A reserva aceita um ou mais serviços, somando valor e duração no servidor e verificando o intervalo completo em transação MongoDB.
- A edição e o reagendamento preservam os totais históricos quando os serviços não mudam.
- O administrador inicial usa ADMIN_USERNAME e ADMIN_PASSWORD do ambiente. O arquivo privado .run/ACESSO-ADMIN.txt contém o acesso configurado neste computador.
- Em Configurações > Administradores, qualquer administrador autenticado pode criar outro com acesso completo. As novas senhas são armazenadas com scrypt e salt no MongoDB; não entram no snapshot público nem nas exportações.
- A aplicação inclui api/handler.mjs e vercel.json, com funções em São Paulo, cookies seguros em HTTPS e pool MongoDB reaproveitado via @vercel/functions.

### Publicação

Na pasta do projeto, execute `npx vercel login` e depois `npm run deploy:vercel`. O script vincula o projeto à conta autenticada, envia as variáveis necessárias via stdin e publica em produção. Credenciais não são argumentos de comandos nem arquivos públicos. Se já houver .vercel/project.json, utiliza o projeto vinculado. A publicação usa o MongoDB Atlas, sem fallback local.

A conta deve ter permissão de publicação na Vercel. O cluster Atlas precisa estar ativo e permitir a rede usada pelo servidor. Para domínio próprio, configure PUBLIC_ORIGIN com a URL HTTPS completa; os domínios de produção e deployment fornecidos pela Vercel já são aceitos.

### Estado verificado nesta atualização

Os testes automatizados e os testes de integração MongoDB isolados passaram. O acesso online ao Atlas apresentou ECONNRESET no handshake TLS dos três nós; isso ocorre antes da autenticação. A Vercel não estava autenticada. Portanto, a publicação e a conexão online ainda aguardam o acesso às contas para verificar e concluir a configuração. O banco de teste usado na validação não substitui o Atlas configurado.

A proteção contra tentativas de login é limitada por instância; configure também as regras de firewall da hospedagem conforme o uso. O .env e node_modules foram retirados do índice Git, preservados no disco e excluídos de novos pacotes. Isso não apaga versões já existentes no histórico Git.

---

## Espaço Jeh Campus

Site e painel de gestão do salão, com agenda, clientes, serviços, galeria e configurações. O armazenamento é selecionado no `.env`: `dataconnect` (Firebase/PostgreSQL remoto), `mongodb` (Firestore compatível com MongoDB) ou `local` (demonstração explícita).

## Abrir e parar

Requer Node.js 22.19 ou superior; este computador tem Node.js 24.

- Dê dois cliques em **Iniciar.cmd** para instalar as dependências necessárias e abrir o site.
- **Reiniciar.cmd** aplica mudanças no `.env` e reinicia apenas este projeto.
- **Parar.cmd** encerra apenas o servidor deste projeto, preservando o banco.
- Equivalentes no terminal: `npm start`, `npm run restart`, `npm run stop`.
- Desenvolvimento: `npm run dev` (Ctrl+C para parar).

Site: http://127.0.0.1:4173/ — Painel: http://127.0.0.1:4173/admin

O endereço acima executa o site neste computador; **o banco em modo dataconnect fica no Google, não no navegador**. Publicar o site para acesso externo é uma etapa separada. Os atalhos evitam servidores duplicados e usam os certificados do Windows sem desativar TLS.

## Banco remoto atual — MongoDB Atlas

O projeto está configurado com `DATA_MODE=mongodb`, conexão `mongodb+srv://` no arquivo privado `.env`, cluster `cluster0.sufeslm.mongodb.net` e banco `jeh_campus`. Não depende do login do Firebase CLI para funcionar neste modo.

O catálogo e as configurações foram transferidos e comparados com a origem. O banco anterior foi preservado. Contas, quando presentes, são migradas com seus hashes de senha; sessões anteriores são encerradas e é necessário entrar novamente. A senha administrativa do `.env` permanece a mesma.

A persistência ativa está em `server/mongoRepository.mjs`: coleções `jeh_campus_services`, `jeh_campus_appointments`, `jeh_campus_customers`, `jeh_campus_blocks`, `jeh_campus_gallery`, `jeh_campus_settings`, `jeh_campus_meta`, `jeh_campus_sessions`, `jeh_campus_requests` e `jeh_campus_private`. Gravações usam transações MongoDB, com controle de concorrência e idempotência de reservas. Credenciais de clientes ficam somente na coleção privada, com senha protegida por scrypt.

Para testar: `npm run db:check`. O teste `node --use-system-ca tests/customer-cloud.integration.mjs` verifica login, reserva e concorrência no banco remoto configurado usando coleções isoladas que são removidas ao final.

## Integração anterior disponível — Data Connect

Projeto: `jehcampus-bd`.
Serviço: `jehcampus-bd-service`, região `southamerica-east1`.
Banco PostgreSQL vinculado: `jehcampus-bd-database`.

O backend usa a API oficial do Firebase Data Connect. Neste computador, `DATA_CONNECT_AUTH=firebase-cli` aproveita o login já existente do Firebase CLI. Não copiamos tokens para o projeto. Se o login for revogado, execute `firebase login` no computador do servidor e reinicie. O navegador nunca recebe credenciais do Google.

Em hospedagem, use `DATA_CONNECT_AUTH=adc` e Application Default Credentials/identidade do ambiente com permissão para o serviço. O modo de autenticação pelo CLI é restrito ao servidor escutando em loopback.

Execute `npm run db:check` para verificar a leitura real do banco configurado. Falhas de conexão não mudam o sistema para armazenamento local. O painel mostra a conexão e a falta de sincronização; reservas só recebem confirmação depois da gravação remota.

### Login do painel

Usuário em `ADMIN_USERNAME` e senha em `ADMIN_PASSWORD`, no arquivo `.env` privado. A senha administrativa é diferente da conta Google. No modo remoto há verificação no servidor e sessão HttpOnly com expiração. No modo local, o login continua sendo uma demonstração.

Não publique, envie ou inclua `.env`, tokens, `.run` ou `node_modules` em arquivos ZIP. `.env.example` contém apenas os nomes das configurações.

## Persistência e concorrência

`server/dataConnectRepository.mjs` adapta as regras existentes ao PostgreSQL remoto. A tabela **SalonState** guarda o estado versionado do salão em JSON (coluna `payload`, texto), incluindo serviços, clientes, agendamentos, bloqueios, galeria, configurações e identificadores idempotentes de reservas. **SalonSession** guarda apenas hashes dos tokens e sua expiração.

Uma atualização SQL condicional só grava se a revisão lida ainda for a atual. Se outro atendimento for salvo durante a operação, o servidor lê novamente e revalida duração, expediente, bloqueios e conflitos. Isso funciona também entre processos diferentes. Não depende de um bloqueio de memória do servidor.

Essa organização simplifica a integração do protótipo e a consistência da agenda de um salão. A leitura e a gravação do estado inteiro não são adequadas para bases grandes; a evolução para tabelas normalizadas pode ser feita no repositório sem alterar as páginas. As tabelas preexistentes do projeto foram preservadas; seu schema anterior está em `database/schema-original.gql`. Não se deve usar as tabelas antigas para alterar a agenda do sistema: use o painel.

Somente o catálogo, fotos e configurações iniciais são carregados no novo banco. Clientes e agendamentos de demonstração não são enviados. Os dados antigos do navegador permanecem separados, sem migração automática.

O schema ativo está em `dataconnect/schema/schema.gql`. Consulte `database/LEIA-ME.md` para diferenciar Data Connect do script legado de MongoDB. Não execute migrações destrutivas ou recrie a instância para atualizar o site.

## Funcionalidades

- Agendamento Serviço → Data → Horário → Dados → Confirmação, sem seleção de profissional.
- Disponibilidade por duração, horário de funcionamento, intervalo, reservas e bloqueios.
- Dashboard e agenda com dia, semana e mês; cadastro manual e reagendamento.
- Status: Agendado, Confirmado, Em atendimento, Concluído, Cancelado e Não compareceu.
- Serviços com preço/duração editáveis, ativação, desativação e exclusão.
- Clientes com histórico e link WhatsApp; fotos da galeria; configurações do salão.
- Menu móvel, ícones SVG locais e tabelas adaptadas para celular.
- Exportação JSON pelo painel. Nenhuma mensagem WhatsApp, SMS ou e-mail é enviada automaticamente.

Os preços iniciais, expediente e política são exemplos que devem ser revisados no painel. Nome, fotos, endereço e Instagram vêm das referências fornecidas. Telefone e WhatsApp precisam ser preenchidos nas configurações.

## Arquitetura

- `dist/components`, `dist/pages`, `dist/admin`: interface reutilizável e páginas.
- `dist/services/domain.js`: regras de negócio compartilhadas com o servidor.
- `dist/services/remoteServices.js`: cache de leitura e chamadas à API; sincronização automática.
- `dist/services/localRepository.js`: demonstração local opcional.
- `server/api.mjs`: autenticação, autorização, validação e proteção dos dados das clientes.
- `server/dataConnectRepository.mjs`: persistência Firebase/PostgreSQL e concorrência.
- `server/mongoRepository.mjs`: alternativa MongoDB com transações.
- `scripts/project.mjs`: inicialização, parada e reinício.

## Verificação

`npm test` verifica regras da agenda, autenticação, privacidade e concorrência do adaptador.
`npm run check` verifica a sintaxe do projeto.
`npm run db:check` consulta o banco remoto sem alterar dados.
`npm run test:database` executa testes de integração MongoDB isolados (requer download inicial do binário oficial).
#   J e h C a m p u s  
 
## Contas e acesso

- Administração: `/admin`, usuário e senha definidos no `.env`. A sessão administrativa é independente da sessão da cliente.
- Clientes: `/entrar` para cadastro/login com e-mail e senha (mínimo de 12 caracteres no cadastro). Nome e WhatsApp são vinculados à conta.
- No agendamento, a etapa Dados pede login/cadastro e preserva serviço, data e horário selecionados. A API recusa reservas anônimas; o administrador continua podendo cadastrar atendimentos manualmente.
- Senhas de clientes usam scrypt com salt aleatório. Cookies de sessão são HttpOnly, SameSite e expiram após 8 horas. Logout revoga a sessão no banco.
- Registros de autenticação ficam separados dos dados públicos, na coleção `jeh_campus_private` do Atlas (ou linhas privadas de SalonState quando usando Data Connect), e não aparecem no export do painel nem nos snapshots das clientes.
- Não há envio de e-mail, verificação de e-mail/WhatsApp ou recuperação automática de senha nesta etapa.
- Teste remoto isolado: `node --use-system-ca tests/customer-cloud.integration.mjs`. Remove somente os próprios registros de teste.
