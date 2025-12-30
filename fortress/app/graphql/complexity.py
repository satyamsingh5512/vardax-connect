"""
GraphQL Complexity Analysis
Security: Prevent resource exhaustion via expensive queries.

Strategy:
1. Parse query AST
2. Calculate cost based on field weights and depth
3. Reject queries exceeding cost/depth limits

NIST Control: SC-5 (Denial of Service Protection)
"""
import os
from typing import Dict, Optional, Any
from dataclasses import dataclass

from app.core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class QueryComplexity:
    """Computed complexity metrics for a GraphQL query."""
    total_cost: int
    max_depth: int
    field_count: int
    list_multiplier: int
    details: Dict[str, Any]


class GraphQLComplexityAnalyzer:
    """
    Analyze GraphQL query complexity.
    Security: Prevent DoS via deeply nested or expensive queries.
    """
    
    # Default field costs (can be customized per schema)
    DEFAULT_FIELD_COSTS = {
        # Expensive operations
        "users": 10,
        "orders": 10,
        "transactions": 15,
        "analytics": 20,
        "reports": 25,
        "search": 15,
        "export": 50,
        
        # Moderate operations
        "user": 5,
        "order": 5,
        "product": 3,
        "category": 2,
        
        # Cheap operations
        "id": 0,
        "name": 1,
        "email": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "__typename": 0,
    }
    
    # List multiplier (cost multiplied for list fields)
    LIST_FIELDS = {"users", "orders", "products", "items", "transactions", "results"}
    DEFAULT_LIST_SIZE = 10  # Assumed list size for cost calculation
    
    def __init__(
        self,
        max_cost: int = None,
        max_depth: int = None,
        field_costs: Dict[str, int] = None,
    ):
        self.max_cost = max_cost or int(os.getenv("GRAPHQL_MAX_COST", "1000"))
        self.max_depth = max_depth or int(os.getenv("GRAPHQL_MAX_DEPTH", "10"))
        self.field_costs = {**self.DEFAULT_FIELD_COSTS, **(field_costs or {})}
    
    def analyze_query(self, query: str, variables: Dict = None) -> QueryComplexity:
        """
        Analyze a GraphQL query string.
        
        Args:
            query: GraphQL query string
            variables: Query variables (for dynamic analysis)
        
        Returns:
            QueryComplexity with computed metrics
        """
        # Parse query into AST
        try:
            ast = self._parse_query(query)
        except Exception as e:
            logger.warning("graphql_parse_failed", extra={"error": str(e)})
            # Return high cost for unparseable queries (fail secure)
            return QueryComplexity(
                total_cost=self.max_cost + 1,
                max_depth=self.max_depth + 1,
                field_count=0,
                list_multiplier=1,
                details={"error": "parse_failed"},
            )
        
        # Calculate complexity
        return self._calculate_complexity(ast, variables or {})
    
    def _parse_query(self, query: str) -> Dict:
        """
        Parse GraphQL query into simplified AST.
        
        Note: In production, use graphql-core library for proper parsing.
        This is a simplified implementation for demonstration.
        """
        # Simple recursive descent parser for demonstration
        # Production should use: from graphql import parse
        
        ast = {
            "type": "Document",
            "definitions": [],
        }
        
        # Extract operation and fields (simplified)
        lines = query.strip().split("\n")
        current_depth = 0
        field_stack = []
        
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            
            # Count braces for depth
            open_braces = stripped.count("{")
            close_braces = stripped.count("}")
            
            # Extract field name
            field_name = stripped.split("(")[0].split("{")[0].strip()
            if field_name and not field_name.startswith("}"):
                field_stack.append({
                    "name": field_name,
                    "depth": current_depth,
                    "is_list": field_name.lower() in self.LIST_FIELDS,
                })
            
            current_depth += open_braces - close_braces
        
        ast["fields"] = field_stack
        ast["max_depth"] = max((f["depth"] for f in field_stack), default=0)
        
        return ast
    
    def _calculate_complexity(self, ast: Dict, variables: Dict) -> QueryComplexity:
        """Calculate complexity from parsed AST."""
        fields = ast.get("fields", [])
        max_depth = ast.get("max_depth", 0)
        
        total_cost = 0
        list_multiplier = 1
        field_details = []
        
        for field in fields:
            field_name = field["name"].lower()
            base_cost = self.field_costs.get(field_name, 1)
            
            # Apply depth multiplier
            depth_multiplier = 1 + (field["depth"] * 0.5)
            
            # Apply list multiplier
            if field["is_list"]:
                # Check variables for explicit limit
                limit = variables.get("limit", variables.get("first", self.DEFAULT_LIST_SIZE))
                list_multiplier = max(list_multiplier, int(limit))
            
            field_cost = int(base_cost * depth_multiplier)
            total_cost += field_cost
            
            field_details.append({
                "field": field_name,
                "base_cost": base_cost,
                "computed_cost": field_cost,
                "depth": field["depth"],
            })
        
        # Apply list multiplier to total
        total_cost *= list_multiplier
        
        return QueryComplexity(
            total_cost=total_cost,
            max_depth=max_depth,
            field_count=len(fields),
            list_multiplier=list_multiplier,
            details={"fields": field_details},
        )
    
    def validate_query(self, query: str, variables: Dict = None) -> tuple[bool, str, QueryComplexity]:
        """
        Validate query against complexity limits.
        
        Returns:
            Tuple of (allowed: bool, reason: str, complexity: QueryComplexity)
        """
        complexity = self.analyze_query(query, variables)
        
        if complexity.max_depth > self.max_depth:
            return False, f"query_too_deep:{complexity.max_depth}>{self.max_depth}", complexity
        
        if complexity.total_cost > self.max_cost:
            return False, f"query_too_expensive:{complexity.total_cost}>{self.max_cost}", complexity
        
        return True, "valid", complexity


# FastAPI middleware for GraphQL complexity enforcement
async def graphql_complexity_middleware(request, call_next):
    """
    Middleware to enforce GraphQL complexity limits.
    
    Usage:
        app.middleware("http")(graphql_complexity_middleware)
    """
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    
    # Only check GraphQL endpoints
    if request.url.path not in ("/graphql", "/api/graphql"):
        return await call_next(request)
    
    # Only check POST requests with body
    if request.method != "POST":
        return await call_next(request)
    
    try:
        body = await request.json()
        query = body.get("query", "")
        variables = body.get("variables", {})
        
        analyzer = GraphQLComplexityAnalyzer()
        allowed, reason, complexity = analyzer.validate_query(query, variables)
        
        if not allowed:
            correlation_id = getattr(request.state, "correlation_id", None)
            
            logger.warning(
                "graphql_complexity_exceeded",
                extra={
                    "reason": reason,
                    "cost": complexity.total_cost,
                    "depth": complexity.max_depth,
                    "correlation_id": correlation_id,
                }
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "errors": [{
                        "message": "Query complexity exceeds limits",
                        "extensions": {
                            "code": "COMPLEXITY_LIMIT_EXCEEDED",
                            "cost": complexity.total_cost,
                            "maxCost": analyzer.max_cost,
                            "depth": complexity.max_depth,
                            "maxDepth": analyzer.max_depth,
                        }
                    }]
                },
            )
        
        # Store complexity in request state for logging
        request.state.graphql_complexity = complexity
        
    except Exception as e:
        logger.warning("graphql_complexity_check_failed", extra={"error": str(e)})
        # Fail open for parsing errors (let GraphQL handle validation)
    
    return await call_next(request)


# Example Strawberry integration
def create_strawberry_complexity_extension():
    """
    Create Strawberry GraphQL extension for complexity analysis.
    
    Usage:
        import strawberry
        from strawberry.extensions import Extension
        
        schema = strawberry.Schema(
            query=Query,
            extensions=[create_strawberry_complexity_extension()]
        )
    """
    # This would be a Strawberry Extension class
    # Simplified for demonstration
    
    class ComplexityExtension:
        def __init__(self):
            self.analyzer = GraphQLComplexityAnalyzer()
        
        def on_request_start(self):
            pass
        
        def on_request_end(self):
            pass
        
        def resolve(self, next_resolver, root, info, **kwargs):
            # Could add per-field cost tracking here
            return next_resolver(root, info, **kwargs)
    
    return ComplexityExtension
