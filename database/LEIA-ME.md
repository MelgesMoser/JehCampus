# Banco ativo: MongoDB Atlas

O sistema usa atualmente o Atlas (`cluster0.sufeslm.mongodb.net`), banco `jeh_campus`. Os dados foram migrados do Data Connect e a origem foi preservada. Use o painel para gerenciar os dados. O backend inicializa bancos vazios automaticamente; não execute o script legado de Firestore neste banco. A conexão e a senha ficam somente no `.env` privado.

Verificação: `npm run db:check`. Mais detalhes no README principal.

## Documentação da integração anterior

# Banco do salão

A integração atual usa **Firebase Data Connect / PostgreSQL**, no projeto `jehcampus-bd`, serviço `jehcampus-bd-service`, em `southamerica-east1`.

- Schema do Data Connect: `../dataconnect/schema/schema.gql`.
- Schema original preservado: `schema-original.gql`.
- Adaptador do sistema: `../server/dataConnectRepository.mjs`.
- Diagnóstico sem escrita: execute `npm run db:check` na pasta `salao`.

Os dados do sistema ficam nas tabelas `SalonState` e `SalonSession`. A primeira contém o estado do salão em JSON com revisão para proteção contra reservas concorrentes. A segunda contém sessões administrativas. Os dados são remotos. As tabelas originais foram preservadas.

## Script MongoDB anterior

`inicializar-banco.mongosh.js` é a alternativa para a conexão **MongoDB/Firestore compatível** enviada anteriormente. Não é SQL e **não deve ser colado no editor do Data Connect**. Ele não é usado no modo `dataconnect`.

Se futuramente optar pelo MongoDB, configure as credenciais reais no `.env` e use `DATA_MODE=mongodb`. Nunca coloque usuário e senha no código nem no navegador. O próprio backend inicializa o catálogo no banco vazio sem criar clientes ou reservas fictícias.

Para o procedimento de execução e autenticação atual, consulte `../README.md`.
