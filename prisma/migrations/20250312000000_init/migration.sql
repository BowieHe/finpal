-- CreateFundBasic
CREATE TABLE "fund_basic" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50),
    "manager" VARCHAR(50),
    "company" VARCHAR(100),
    "established_date" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_basic_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "idx_fund_basic_name" ON "fund_basic"("name");

-- CreateFundNav
CREATE TABLE "fund_nav" (
    "id" SERIAL NOT NULL,
    "fund_code" VARCHAR(10) NOT NULL,
    "nav_date" TIMESTAMP(6) NOT NULL,
    "unit_nav" DECIMAL(10, 4) NOT NULL,
    "accum_nav" DECIMAL(10, 4) NOT NULL,
    "daily_return" DECIMAL(6, 2),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_nav_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fund_nav_fund_code_nav_date_key" ON "fund_nav"("fund_code", "nav_date");
CREATE INDEX "idx_fund_nav_code" ON "fund_nav"("fund_code");
CREATE INDEX "idx_fund_nav_date" ON "fund_nav"("nav_date");

ALTER TABLE "fund_nav" ADD CONSTRAINT "fund_nav_fund_code_fkey" FOREIGN KEY ("fund_code") REFERENCES "fund_basic"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateUserHoldings
CREATE TABLE "user_holdings" (
    "id" TEXT NOT NULL,
    "fund_code" VARCHAR(10) NOT NULL,
    "fund_name" VARCHAR(100) NOT NULL,
    "shares" DECIMAL(15, 4) NOT NULL,
    "cost_price" DECIMAL(10, 4) NOT NULL,
    "buy_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_holdings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_holdings_fund_code_idx" ON "user_holdings"("fund_code");

-- CreateHoldingTransactions
CREATE TABLE "holding_transactions" (
    "id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shares" DECIMAL(15, 4) NOT NULL,
    "price" DECIMAL(10, 4) NOT NULL,
    "amount" DECIMAL(15, 2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "holding_transactions_holding_id_idx" ON "holding_transactions"("holding_id");

ALTER TABLE "holding_transactions" ADD CONSTRAINT "holding_transactions_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "user_holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateSettings
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "api_url" TEXT,
    "model_name" TEXT,
    "api_key" TEXT,
    "dashscope_api_key" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
