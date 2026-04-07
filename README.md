# pcbdoc-ai-validator
Intelligent debugging assistant for Altium Designer PCB projects.  

Usage:  

```shell
python src/python/main.py
```

To ignore some script steps and start from a specific step:  
```shell
python src/python/main.py --step=6
```

To save output data to the same folder on every script run:  
```shell
python src/python/main.py --no-tmp-timestamp
```
