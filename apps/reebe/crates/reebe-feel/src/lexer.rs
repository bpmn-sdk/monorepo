use crate::types::FeelError;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Literals
    Null,
    True,
    False,
    Integer(i64),
    Float(f64),
    StringLit(String),
    // Identifiers and keywords
    Ident(String),
    // Operators
    Plus,
    Minus,
    Star,
    Slash,
    // Comparison
    Eq,    // =
    Ne,    // !=
    Lt,    // <
    Le,    // <=
    Gt,    // >
    Ge,    // >=
    // Boolean keywords
    And,
    Or,
    Not,
    // Control
    If,
    Then,
    Else,
    For,
    In,
    Return,
    Some,
    Every,
    Satisfies,
    // Delimiters
    Dot,           // .
    Comma,         // ,
    Colon,         // :
    LParen,        // (
    RParen,        // )
    LBracket,      // [
    RBracket,      // ]
    LBrace,        // {
    RBrace,        // }
    DoubleDot,     // ..
    // Special
    InstanceOf,
    Eof,
}

/// Multi-word built-in function names that need to be recognized as single tokens.
/// Order matters: longer ones first to avoid partial matches.
const MULTI_WORD_BUILTINS: &[&str] = &[
    "string length",
    "upper case",
    "lower case",
    "starts with",
    "ends with",
    "string join",
    "list contains",
    "insert before",
    "index of",
    "distinct values",
    "round up",
    "round down",
    "years and months duration",
    "date and time",
    "is defined",
    "get value",
    "get entries",
    "get or else",
    "context merge",
];

pub fn tokenize(input: &str) -> Result<Vec<Token>, FeelError> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        // Skip whitespace
        if chars[i].is_whitespace() {
            i += 1;
            continue;
        }

        // String literals
        if chars[i] == '"' {
            i += 1;
            let mut s = String::new();
            while i < chars.len() && chars[i] != '"' {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    i += 1;
                    match chars[i] {
                        '"' => s.push('"'),
                        'n' => s.push('\n'),
                        't' => s.push('\t'),
                        'r' => s.push('\r'),
                        '\\' => s.push('\\'),
                        other => {
                            s.push('\\');
                            s.push(other);
                        }
                    }
                } else {
                    s.push(chars[i]);
                }
                i += 1;
            }
            if i >= chars.len() {
                return Err(FeelError::LexerError("Unterminated string literal".to_string()));
            }
            i += 1; // closing "
            tokens.push(Token::StringLit(s));
            continue;
        }

        // Numbers (but not negative numbers here — unary minus is handled by parser)
        if chars[i].is_ascii_digit() {
            let start = i;
            while i < chars.len() && chars[i].is_ascii_digit() {
                i += 1;
            }
            // Check for float
            let is_float = i < chars.len() && chars[i] == '.'
                && (i + 1 >= chars.len() || chars[i + 1] != '.');
            if is_float {
                i += 1; // consume '.'
                while i < chars.len() && chars[i].is_ascii_digit() {
                    i += 1;
                }
                let num_str: String = chars[start..i].iter().collect();
                let f: f64 = num_str.parse().map_err(|_| FeelError::LexerError(format!("Invalid float: {}", num_str)))?;
                tokens.push(Token::Float(f));
            } else {
                let num_str: String = chars[start..i].iter().collect();
                let n: i64 = num_str.parse().map_err(|_| FeelError::LexerError(format!("Invalid integer: {}", num_str)))?;
                tokens.push(Token::Integer(n));
            }
            continue;
        }

        // Identifiers and keywords
        if chars[i].is_alphabetic() || chars[i] == '_' {
            // First, check if the remaining input starts with a multi-word builtin
            let remaining: String = chars[i..].iter().collect();
            let mut matched_mw = false;
            for kw in MULTI_WORD_BUILTINS {
                let kw_lower = kw.to_lowercase();
                if remaining.to_lowercase().starts_with(kw_lower.as_str()) {
                    // Make sure the match is complete (not part of a longer identifier)
                    let end_idx = i + kw.len();
                    let next_char = chars.get(end_idx);
                    let is_complete = next_char.map_or(true, |c| !c.is_alphanumeric() && *c != '_');
                    if is_complete {
                        tokens.push(Token::Ident(kw.to_string()));
                        i += kw.len();
                        matched_mw = true;
                        break;
                    }
                }
            }
            if matched_mw {
                continue;
            }

            // Regular identifier or keyword
            let start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();
            let token = match word.as_str() {
                "null" => Token::Null,
                "true" => Token::True,
                "false" => Token::False,
                "and" => Token::And,
                "or" => Token::Or,
                "not" => Token::Not,
                "if" => Token::If,
                "then" => Token::Then,
                "else" => Token::Else,
                "for" => Token::For,
                "in" => Token::In,
                "return" => Token::Return,
                "some" => Token::Some,
                "every" => Token::Every,
                "satisfies" => Token::Satisfies,
                "instance" => {
                    // peek for " of"
                    let j = i;
                    // skip whitespace
                    let mut k = j;
                    while k < chars.len() && chars[k] == ' ' { k += 1; }
                    if k + 1 < chars.len() && chars[k] == 'o' && chars[k + 1] == 'f' {
                        // check that 'of' is not part of a longer word
                        let after_of = k + 2;
                        if after_of >= chars.len() || !chars[after_of].is_alphanumeric() {
                            i = after_of;
                            Token::InstanceOf
                        } else {
                            Token::Ident(word)
                        }
                    } else {
                        Token::Ident(word)
                    }
                }
                _ => Token::Ident(word),
            };
            tokens.push(token);
            continue;
        }

        // Operators and punctuation
        match chars[i] {
            '+' => { tokens.push(Token::Plus); i += 1; }
            '*' => { tokens.push(Token::Star); i += 1; }
            '/' => { tokens.push(Token::Slash); i += 1; }
            '-' => { tokens.push(Token::Minus); i += 1; }
            '(' => { tokens.push(Token::LParen); i += 1; }
            ')' => { tokens.push(Token::RParen); i += 1; }
            '[' => { tokens.push(Token::LBracket); i += 1; }
            ']' => { tokens.push(Token::RBracket); i += 1; }
            '{' => { tokens.push(Token::LBrace); i += 1; }
            '}' => { tokens.push(Token::RBrace); i += 1; }
            ',' => { tokens.push(Token::Comma); i += 1; }
            ':' => { tokens.push(Token::Colon); i += 1; }
            '.' => {
                if i + 1 < chars.len() && chars[i + 1] == '.' {
                    tokens.push(Token::DoubleDot);
                    i += 2;
                } else {
                    tokens.push(Token::Dot);
                    i += 1;
                }
            }
            '=' => { tokens.push(Token::Eq); i += 1; }
            '!' => {
                if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token::Ne);
                    i += 2;
                } else {
                    return Err(FeelError::LexerError(format!("Unexpected character '!' at position {}", i)));
                }
            }
            '<' => {
                if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token::Le);
                    i += 2;
                } else {
                    tokens.push(Token::Lt);
                    i += 1;
                }
            }
            '>' => {
                if i + 1 < chars.len() && chars[i + 1] == '=' {
                    tokens.push(Token::Ge);
                    i += 2;
                } else {
                    tokens.push(Token::Gt);
                    i += 1;
                }
            }
            c => {
                return Err(FeelError::LexerError(format!("Unexpected character '{}' at position {}", c, i)));
            }
        }
    }

    tokens.push(Token::Eof);
    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_tokens() {
        let tokens = tokenize("1 + 2").unwrap();
        assert_eq!(tokens[0], Token::Integer(1));
        assert_eq!(tokens[1], Token::Plus);
        assert_eq!(tokens[2], Token::Integer(2));
    }

    #[test]
    fn test_string_literal() {
        let tokens = tokenize(r#""hello world""#).unwrap();
        assert_eq!(tokens[0], Token::StringLit("hello world".to_string()));
    }

    #[test]
    fn test_comparison_ops() {
        let tokens = tokenize("x <= 10").unwrap();
        assert_eq!(tokens[0], Token::Ident("x".to_string()));
        assert_eq!(tokens[1], Token::Le);
        assert_eq!(tokens[2], Token::Integer(10));
    }

    #[test]
    fn test_dotdot() {
        let tokens = tokenize("1..10").unwrap();
        assert_eq!(tokens[0], Token::Integer(1));
        assert_eq!(tokens[1], Token::DoubleDot);
        assert_eq!(tokens[2], Token::Integer(10));
    }

    #[test]
    fn test_keywords() {
        let tokens = tokenize("if x then y else z").unwrap();
        assert_eq!(tokens[0], Token::If);
        assert_eq!(tokens[2], Token::Then);
        assert_eq!(tokens[4], Token::Else);
    }

    #[test]
    fn test_multi_word_builtins() {
        let tokens = tokenize("string length").unwrap();
        assert_eq!(tokens[0], Token::Ident("string length".to_string()));

        let tokens = tokenize("upper case").unwrap();
        assert_eq!(tokens[0], Token::Ident("upper case".to_string()));

        let tokens = tokenize("starts with").unwrap();
        assert_eq!(tokens[0], Token::Ident("starts with".to_string()));
    }

    #[test]
    fn test_boolean_keywords() {
        let tokens = tokenize("x and y or z").unwrap();
        assert_eq!(tokens[1], Token::And);
        assert_eq!(tokens[3], Token::Or);
    }
}
