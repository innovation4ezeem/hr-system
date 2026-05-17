# SQL Server MDF Setup

This project stores Performance Scores in SQL Server using a local `.mdf` file.

## One-click commands

From project root:

```bash
npm run db:setup
```

This will start SQL Server container and run DB init SQL.

`db:init` now applies these scripts in order when present:
- `create-hr-operations-db.sql`
- `create-leave-management-db.sql`
- `create-employee-performance-hr-module.sql`
- `create-schema-integrity-migration.sql`

Other helpers:

```bash
npm run db:up
npm run db:init
npm run db:down
```

Optional environment variables:

```bash
DB_CONTAINER_NAME=hr-sql
DB_SA_PASSWORD=YourStrong!Passw0rd
DB_PORT=1433
```

## 1) Run SQL Server with local `database/` folder mounted

```bash
docker run --name hr-sql \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" \
  -p 1433:1433 \
  -v "$(pwd)/database:/var/opt/mssql/data" \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

## 2) Create DB + table + MDF/LDF files

```bash
docker exec -it hr-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "YourStrong!Passw0rd" -C \
  -i /var/opt/mssql/data/create-hr-operations-db.sql
```

After this step, these files are created inside this folder:
- `database/HROperations.mdf`
- `database/HROperations_log.ldf`

## 3) Add SQL env vars in `.env`

```env
SQL_SERVER_HOST=127.0.0.1
SQL_SERVER_PORT=1433
SQL_SERVER_USER=sa
SQL_SERVER_PASSWORD=YourStrong!Passw0rd
SQL_SERVER_DATABASE=HROperationsDB
```

## 4) Start app

```bash
npm run dev
```

Data from admin Performance Scores page is now saved into SQL Server.
