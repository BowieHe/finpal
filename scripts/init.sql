-- Database Initialization Script

-- 1. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    api_url TEXT,
    model_name TEXT,
    api_key TEXT,
    dashscope_api_key TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fund Basic Information
CREATE TABLE IF NOT EXISTS fund_basic (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Fund Net Asset Value (NAV) History
CREATE TABLE IF NOT EXISTS fund_nav (
    id SERIAL PRIMARY KEY,
    fund_code TEXT NOT NULL REFERENCES fund_basic(code),
    nav_date DATE NOT NULL,
    unit_nav NUMERIC(12, 4) NOT NULL,
    accumulated_nav NUMERIC(12, 4),
    daily_return NUMERIC(10, 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fund_code, nav_date)
);

-- 4. User Holdings
CREATE TABLE IF NOT EXISTS user_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code TEXT NOT NULL,
    fund_name TEXT,
    shares NUMERIC(16, 4) NOT NULL DEFAULT 0,
    cost_price NUMERIC(16, 4) NOT NULL DEFAULT 0,
    buy_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Holding Transactions
CREATE TABLE IF NOT EXISTS holding_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_id UUID NOT NULL REFERENCES user_holdings(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'buy' or 'sell'
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    shares NUMERIC(16, 4) NOT NULL,
    price NUMERIC(16, 4) NOT NULL,
    amount NUMERIC(16, 4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Karma Logs (User Behavior Tracking)
CREATE TABLE IF NOT EXISTS karma_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL, -- 'screenshot' or 'chat'
    content TEXT NOT NULL,
    interpretation TEXT, -- Stores JSON string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. User Profiles (Evolutionary Persona)
CREATE TABLE IF NOT EXISTS user_profile (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL,
    persona TEXT NOT NULL,
    styles TEXT, -- Stores JSON string
    biases TEXT[], -- Postgres text array
    evolutionary_log TEXT,
    summary TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings row if not exists
INSERT INTO settings (id, api_url, model_name) 
VALUES (1, 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-vl-max')
ON CONFLICT (id) DO NOTHING;
