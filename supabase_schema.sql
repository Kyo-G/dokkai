-- Dokkai Database Schema
-- Run this in your Supabase SQL editor

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '无标题',
  content TEXT NOT NULL,
  level TEXT CHECK (level IN ('N5', 'N4', 'N3', 'N2', 'N1', '')) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sentences table (per article, split by sentence)
CREATE TABLE IF NOT EXISTS sentences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  analysis_cache JSONB DEFAULT NULL,
  is_analyzed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentences_article_id ON sentences(article_id);

-- Words table (vocabulary book)
CREATE TABLE IF NOT EXISTS words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  reading TEXT NOT NULL,
  pos TEXT NOT NULL,
  meaning TEXT NOT NULL,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  details_cache JSONB DEFAULT NULL,
  is_detailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review records table (SM-2 spaced repetition)
CREATE TABLE IF NOT EXISTS review_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word_id UUID REFERENCES words(id) ON DELETE CASCADE UNIQUE,
  next_review_date DATE NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_records_next_date ON review_records(next_review_date);

-- Grammar points table
CREATE TABLE IF NOT EXISTS grammar_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern TEXT NOT NULL UNIQUE,
  meaning TEXT NOT NULL,
  usage TEXT NOT NULL DEFAULT '',
  jlpt TEXT NOT NULL DEFAULT '',
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grammar review records table (SM-2 spaced repetition)
CREATE TABLE IF NOT EXISTS grammar_review_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grammar_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE UNIQUE,
  next_review_date DATE NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_review_next_date ON grammar_review_records(next_review_date);

-- Enable RLS (Row Level Security) — open policies for personal use
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_review_records ENABLE ROW LEVEL SECURITY;

-- Allow all operations (personal use, no auth)
CREATE POLICY "Allow all" ON articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sentences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON words FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON review_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON grammar_points FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON grammar_review_records FOR ALL USING (true) WITH CHECK (true);
