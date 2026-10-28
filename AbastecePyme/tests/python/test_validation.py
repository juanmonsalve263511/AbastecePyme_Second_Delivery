import unittest
from pydantic import ValidationError
from backend.Models import Registration, AccountEdit, ElementCreate, ElementEdit
class ValidationTests(unittest.TestCase):
    def test_whitespace_is_not_a_name(self):
        Inputs=[(Registration,dict(Username='test',DisplayName='  ',Password='Test-value-not-a-secret')),
                (AccountEdit,dict(DisplayName='  ')),
                (ElementCreate,dict(ElementId='TEST-X',Name=' a ',ElementType='Material')),
                (ElementEdit,dict(Name=' a ',Version=1))]
        for Model,Body in Inputs:
            with self.subTest(Model=Model.__name__), self.assertRaises(ValidationError):
                Model(**Body)
