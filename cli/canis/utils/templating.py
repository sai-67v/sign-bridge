"""
Template variable interpolation for pipelines.

Supports {{variable}} syntax and Jinja2 control structures like {% for %} and {% if %}.
"""

import re
from typing import Dict, Any

# Import Jinja2 for full template support
from jinja2 import Environment, BaseLoader, TemplateSyntaxError, Undefined


def interpolate(template: str, variables: Dict[str, Any]) -> str:
    """
    Replace {{variable}} placeholders with values from variables dict.
    Also supports Jinja2 control structures like {% for %} and {% if %}.
    
    Args:
        template: String with {{variable}} placeholders or Jinja2 syntax
        variables: Dict of variable values
    
    Returns:
        Interpolated string
    
    Examples:
        >>> interpolate("Hello {{name}}", {"name": "World"})
        'Hello World'
        
        >>> interpolate("{{input}} is {{count}}", {"input": "Test", "count": 5})
        'Test is 5'
        
        >>> interpolate("{% for item in items %}{{item}} {% endfor %}", {"items": ["a", "b"]})
        'a b '
    """
    if not template:
        return template
    
    # Check if template contains Jinja2 control structures
    has_jinja2_control = '{%' in template
    
    if has_jinja2_control:
        # Use Jinja2 for full template rendering; missing vars render as ''
        try:
            class SilentUndefined(Undefined):
                def __str__(self):
                    return ""
                def __bool__(self):
                    return False
            env = Environment(loader=BaseLoader(), autoescape=False, undefined=SilentUndefined)
            jinja_template = env.from_string(template)
            return jinja_template.render(**variables)
        except TemplateSyntaxError as e:
            # Fall back to simple interpolation if Jinja2 syntax is invalid
            print(f"[WARNING] Jinja2 template error: {e}")
        except Exception as e:
            # Fall back on any other error
            print(f"[WARNING] Template rendering error: {e}")
    
    # Simple {{variable}} replacement for templates without control structures
    def replace_var(match):
        var_name = match.group(1).strip()
        value = variables.get(var_name, "")
        return str(value)
    
    # Match {{variable}} pattern
    pattern = r'\{\{([^}]+)\}\}'
    return re.sub(pattern, replace_var, template)


def extract_variables(template: str) -> list[str]:
    """
    Extract all variable names from template.
    
    Args:
        template: String with {{variable}} placeholders
    
    Returns:
        List of variable names
    
    Examples:
        >>> extract_variables("Hello {{name}} from {{location}}")
        ['name', 'location']
    """
    pattern = r'\{\{([^}]+)\}\}'
    matches = re.findall(pattern, template)
    return [m.strip() for m in matches]
