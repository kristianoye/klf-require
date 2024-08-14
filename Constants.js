'use strict';
/**
 * KLF Require Core
 * Written by Kristian Oye
 * Date: August 13, 2024
 * 
 * Contains enumerated types used throughout this library.
 * 
 * @version 1.0.0
 */

const EnumUtil = require('./util/EnumUtil');

const DetailLevelString = ['', '   NONE', '  ERROR', 'WARNING', '  DEBUG', 'VERBOSE'];

const LogDetailLevel = EnumUtil.createEnum('LogDetailLevel', {
    /** Inane detail */
    Verbose: 5,
    /** Information helpful to configuring the importer */
    Debug: 4,
    /** Some expected behavior did not execute as expected */
    Warning: 3,
    /** An error occurred and the current module could not be handled */
    Error: 2,
    /** No Detail provided */
    None: 1
});

const ReservedWord = EnumUtil.createEnum('ReservedWord', {
    Await: 'await',
    Break: 'break',
    Case: 'case',
    Catch: 'catch',
    Class: 'class',
    Const: 'const',
    Continue: 'continue',
    Debugger: 'debugger',
    Default: 'default',
    Delete: 'delete',
    Do: 'do',
    Else: 'else',
    Export: 'export',
    Extends: 'extends',
    Finally: 'finally',
    For: 'for',
    Function: 'function',
    If: 'if',
    Implements: 'implements',
    In: 'in',
    Interface: 'interface',
    InstanceOf: 'instanceof',
    Let: 'let',
    New: 'new',
    Package: 'package',
    Private: 'private',
    Protected: 'protected',
    Public: 'public',
    Return: 'return',
    Static: 'static',
    Super: 'super',
    Switch: 'switch',
    This: 'this',
    Throw: 'throw',
    Try: 'try',
    TypeOf: 'typeof',
    Var: 'var',
    Void: 'void',
    While: 'while',
    With: 'with',
    Yield: 'yield'
}, 'string');

const TokenizerScope = EnumUtil.createEnum('TokenizerScope', {
    ArrowFunction: 'ArrowFunction',
    Class: 'Class',
    Function: 'Function',
    Global: 'Global',
    Member: 'Member'
});

const TokenType = EnumUtil.createEnum('TokenType', {
    Unknown: 'Unknown',
    ArrowFunction: 'ArrowFunction',
    Assignment: 'Assignment',
    BlockStatement: 'BlockStatement',
    BlockStatementEnd: 'BlockStatementEnd',
    BlockStatementStart: 'BlockStatementStart',
    CurlyBrace: 'CurlyBrace',
    Class: 'Class',
    ClassBody: 'ClassBody',
    CommentBlock: 'CommentBlock',
    CommentInline: 'CommentInline',
    Equality: 'Equality',
    Function: 'Function',
    /** The global namespace */
    Global: 'Global',
    Identifier: 'Identifier',
    Member: 'Member',
    /** A numeric literal */
    Number: 'Number',
    Parameter: 'Parameter',
    ParameterList: 'ParameterList',
    ParameterListEnd: 'ParameterListEnd',
    Paranthesis: 'Paranthesis',
    RawText: 'RawText',
    ReservedWord: 'ReservedWord',
    Semicolon: 'Semicolon',
    Whitespace: 'Whitespace'
});

module.exports = {
    DetailLevelString,
    LogDetailLevel,
    ReservedWord,
    TokenizerScope,
    TokenType
};